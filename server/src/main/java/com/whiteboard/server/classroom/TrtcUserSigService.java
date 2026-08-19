package com.whiteboard.server.classroom;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.zip.Deflater;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/** Generates Tencent TRTC UserSig exclusively on the trusted server. */
@Service
public class TrtcUserSigService {
  private final ObjectMapper json;
  private final long sdkAppId;
  private final String secretKey;
  private final long expireSeconds;

  public TrtcUserSigService(ObjectMapper json,
      @Value("${whiteboard.trtc.sdk-app-id:0}") long sdkAppId,
      @Value("${whiteboard.trtc.secret-key:}") String secretKey,
      @Value("${whiteboard.trtc.user-sig-expire-seconds:7200}") long expireSeconds) {
    this.json=json;this.sdkAppId=sdkAppId;this.secretKey=secretKey;this.expireSeconds=expireSeconds;
  }

  public Map<String,Object> issue(String roomId,String userId,boolean publishAudio) {
    if(sdkAppId<=0||secretKey.trim().isEmpty()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,"TRTC 尚未在服务端配置");
    long now=System.currentTimeMillis()/1000;
    Map<String,Object> doc=new LinkedHashMap<>();
    doc.put("TLS.ver","2.0");doc.put("TLS.identifier",userId);doc.put("TLS.sdkappid",sdkAppId);
    doc.put("TLS.expire",expireSeconds);doc.put("TLS.time",now);
    doc.put("TLS.sig",sign(userId,now));
    Map<String,Object> result=new LinkedHashMap<>();result.put("sdkAppId",sdkAppId);result.put("roomId",roomId);
    result.put("userId",userId);result.put("userSig",compress(doc));result.put("expiresAt",(now+expireSeconds)*1000);
    result.put("publishAudio",publishAudio);return result;
  }

  private String sign(String userId,long now){
    try{
      String source="TLS.identifier:"+userId+"\nTLS.sdkappid:"+sdkAppId+"\nTLS.time:"+now+"\nTLS.expire:"+expireSeconds+"\n";
      Mac mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(secretKey.getBytes(StandardCharsets.UTF_8),"HmacSHA256"));
      return Base64.getEncoder().encodeToString(mac.doFinal(source.getBytes(StandardCharsets.UTF_8)));
    }catch(Exception error){throw new IllegalStateException("无法生成 TRTC UserSig",error);}
  }

  private String compress(Map<String,Object> value){
    try{
      byte[] input=json.writeValueAsBytes(value);Deflater deflater=new Deflater();deflater.setInput(input);deflater.finish();
      ByteArrayOutputStream out=new ByteArrayOutputStream(input.length);byte[] buffer=new byte[512];
      while(!deflater.finished())out.write(buffer,0,deflater.deflate(buffer));deflater.end();
      return Base64.getEncoder().encodeToString(out.toByteArray()).replace('+','*').replace('/','-').replace('=','_');
    }catch(Exception error){throw new IllegalStateException("无法编码 TRTC UserSig",error);}
  }
}
