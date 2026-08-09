package com.whiteboard.server.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConfigurationProperties(prefix = "whiteboard")
public class WhiteboardProperties {
  private String storageRoot;
  private Qiniu qiniu = new Qiniu();

  public String getStorageRoot() {
    return storageRoot;
  }

  public void setStorageRoot(String storageRoot) {
    this.storageRoot = storageRoot;
  }

  public Qiniu getQiniu() {
    return qiniu;
  }

  public void setQiniu(Qiniu qiniu) {
    this.qiniu = qiniu;
  }

  public static class Qiniu {
    private String accessKey;
    private String secretKey;
    private String bucket;
    private String uploadUrl;
    private String publicDomain;
    private long tokenExpireSeconds = 3600;

    public String getAccessKey() {
      return accessKey;
    }

    public void setAccessKey(String accessKey) {
      this.accessKey = accessKey;
    }

    public String getSecretKey() {
      return secretKey;
    }

    public void setSecretKey(String secretKey) {
      this.secretKey = secretKey;
    }

    public String getBucket() {
      return bucket;
    }

    public void setBucket(String bucket) {
      this.bucket = bucket;
    }

    public String getUploadUrl() {
      return uploadUrl;
    }

    public void setUploadUrl(String uploadUrl) {
      this.uploadUrl = uploadUrl;
    }

    public String getPublicDomain() {
      return publicDomain;
    }

    public void setPublicDomain(String publicDomain) {
      this.publicDomain = publicDomain;
    }

    public long getTokenExpireSeconds() {
      return tokenExpireSeconds;
    }

    public void setTokenExpireSeconds(long tokenExpireSeconds) {
      this.tokenExpireSeconds = tokenExpireSeconds;
    }
  }
}
