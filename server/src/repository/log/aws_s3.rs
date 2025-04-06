use async_trait::async_trait;
use std::path::{PathBuf};
use anyhow::{Error, Context};
use aws_config::BehaviorVersion;
use aws_config::meta::region::RegionProviderChain;
use crate::repository::LogRepository;
use tokio::fs::{File};
use aws_sdk_s3::Client;
use aws_sdk_s3::config::{Region, Credentials};
use aws_sdk_s3::primitives::ByteStream;
use futures::StreamExt;

#[derive(Clone)]
pub struct LogRepositoryAWSS3 {
    cache_dir: PathBuf,
    client: Client,
    bucket: String,
    prefix: Option<String>,
}

impl LogRepositoryAWSS3 {
    pub async fn new(
        cache_dir: PathBuf,
        aws_access_key_id: Option<String>,
        aws_secret_access_key: Option<String>,
        aws_region: Option<String>,
        bucket: String,
        prefix: Option<String>,
        endpoint: Option<String>,
    ) -> Result<Self, Error> {

        // Configure region or endpoint
        let region_provider = RegionProviderChain::first_try(aws_region.map(Region::new))
            .or_default_provider();

        let mut config_loader = aws_config::defaults(BehaviorVersion::latest()).region(region_provider);

        // If credentials were explicitly passed, override provider
        if aws_access_key_id.is_some() && aws_secret_access_key.is_some() {
            let credentials = Credentials::new(
                aws_access_key_id.unwrap(),
                aws_secret_access_key.unwrap(),
                None,
                None,
                "log_repository",
            );
            config_loader = config_loader.credentials_provider(credentials);
        }

        let shared_config = config_loader.load().await;

        let mut config = aws_sdk_s3::config::Builder::from(&shared_config);

        if let Some(endpoint_url) = endpoint {
            config = config.endpoint_url(endpoint_url);
        }

        let client = Client::from_conf(config.build());


        Ok(Self {
            cache_dir,
            client,
            bucket,
            prefix,
        })
    }

    fn get_s3_key(&self, job_id: &str) -> String {
        match &self.prefix {
            Some(prefix) => format!("{}/{}.tgz", prefix.trim_end_matches('/'), job_id),
            None => format!("{}.tgz", job_id),
        }
    }
}

#[async_trait]
impl LogRepository for LogRepositoryAWSS3 {
    fn get_cache_folder(&self) -> PathBuf {
        self.cache_dir.clone()
    }

    async fn upload_archive_to_storage(&self, job_id: &str, archive_path: &PathBuf) -> Result<(), Error> {
        let key = self.get_s3_key(job_id);
        let body = ByteStream::from_path(archive_path.clone()).await
            .with_context(|| format!("Failed to stream file {}", archive_path.display()))?;

        self.client.put_object()
            .bucket(&self.bucket)
            .key(&key)
            .body(body)
            .send()
            .await
            .with_context(|| format!("Failed to upload archive {} to S3", archive_path.display()))?;

        Ok(())
    }

    async fn retrieve_archive_from_storage(&self, job_id: &str, archive_name: &PathBuf) -> Result<(), anyhow::Error> {
        let key = self.get_s3_key(job_id);
        let resp = self.client.get_object()
            .bucket(&self.bucket)
            .key(&key)
            .send()
            .await
            .with_context(|| format!("Failed to retrieve archive {} from S3", key))?;

        let mut body_stream = resp.body.into_async_read();
        let mut out_file = File::create(archive_name).await?;

        tokio::io::copy(&mut body_stream, &mut out_file).await?;

        Ok(())
    }
}