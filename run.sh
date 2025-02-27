#!/usr/bin/env bash

zellij run -c -- ./target/debug/workflow-server -v --workspace /Users/ala/workspace/personal/workflow-engine/files/workspace
zellij run -c -- ./target/debug/workflow-worker -v
