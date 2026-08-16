package com.whiteboard.server.auth;

import com.fasterxml.jackson.databind.JsonNode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
  private final JdbcTemplate jdbc;
  private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(12);

  public AuthService(JdbcTemplate jdbc) { this.jdbc = jdbc; }

  public Map<String, Object> register(JsonNode input) {
    String mobile = required(input.path("mobile").asText(), "手机号");
    String password = required(input.path("password").asText(), "密码");
    String name = required(input.path("displayName").asText(), "姓名");
    String role = input.path("role").asText("teacher");
    if (!"teacher".equals(role) && !"student".equals(role)) throw badRequest("不支持的账户角色");
    if (!mobile.matches("^1\\d{10}$")) throw badRequest("请输入正确的手机号");
    if (password.length() < 8) throw badRequest("密码至少需要 8 位");
    String userId = "user_" + UUID.randomUUID().toString().replace("-", "");
    LocalDateTime now = LocalDateTime.now();
    try {
      jdbc.update("INSERT INTO user_account (id,mobile,email,password_hash,display_name,role,status,created_at,updated_at) VALUES (?,?,?,?,?,?,'active',?,?)",
        userId, mobile, nullable(input.path("email").asText()), passwordEncoder.encode(password), name, role,
        Timestamp.valueOf(now), Timestamp.valueOf(now));
    } catch (DuplicateKeyException error) { throw new ResponseStatusException(HttpStatus.CONFLICT, "手机号或邮箱已注册"); }
    if ("teacher".equals(role)) jdbc.update("INSERT INTO teacher_profile (user_id,created_at,updated_at) VALUES (?,?,?)", userId, Timestamp.valueOf(now), Timestamp.valueOf(now));
    return createSession(userId);
  }

  public Map<String, Object> login(JsonNode input) {
    String account = required(input.path("account").asText(), "账号");
    String password = required(input.path("password").asText(), "密码");
    Map<String, Object> user;
    try {
      user = jdbc.queryForObject("SELECT id,mobile,email,password_hash,display_name,role,status FROM user_account WHERE mobile=? OR email=? LIMIT 1",
        (rs, n) -> { Map<String, Object> row = new LinkedHashMap<>(); row.put("id", rs.getString("id")); row.put("mobile", rs.getString("mobile")); row.put("email", rs.getString("email")); row.put("passwordHash", rs.getString("password_hash")); row.put("displayName", rs.getString("display_name")); row.put("role", rs.getString("role")); row.put("status", rs.getString("status")); return row; }, account, account);
    } catch (Exception error) { throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "账号或密码错误"); }
    if (!"active".equals(user.get("status")) || !passwordEncoder.matches(password, String.valueOf(user.get("passwordHash")))) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "账号或密码错误");
    return createSession(String.valueOf(user.get("id")));
  }

  public Map<String, Object> authenticate(String token) {
    if (token == null || token.trim().isEmpty()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "请先登录");
    try {
      return jdbc.queryForObject("SELECT u.id,u.mobile,u.email,u.display_name,u.role,u.status FROM auth_session s JOIN user_account u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>?",
        (rs, n) -> { Map<String, Object> row = new LinkedHashMap<>(); row.put("id", rs.getString("id")); row.put("mobile", rs.getString("mobile")); row.put("email", rs.getString("email")); row.put("displayName", rs.getString("display_name")); row.put("role", rs.getString("role")); row.put("status", rs.getString("status")); return row; }, hash(token), Timestamp.valueOf(LocalDateTime.now()));
    } catch (Exception error) { throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "登录状态已失效"); }
  }

  public void logout(String token) { if (token != null) jdbc.update("UPDATE auth_session SET revoked_at=? WHERE token_hash=?", Timestamp.valueOf(LocalDateTime.now()), hash(token)); }

  private Map<String, Object> createSession(String userId) {
    byte[] bytes = new byte[32]; new java.security.SecureRandom().nextBytes(bytes);
    String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    LocalDateTime now = LocalDateTime.now();
    LocalDateTime expiresAt = now.plusDays(30);
    jdbc.update("INSERT INTO auth_session (id,user_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)", "session_" + UUID.randomUUID().toString().replace("-", ""), userId, hash(token), Timestamp.valueOf(expiresAt), Timestamp.valueOf(now));
    Map<String, Object> result = new LinkedHashMap<>(); result.put("token", token); result.put("expiresAt", expiresAt.toString()); result.put("user", authenticate(token)); return result;
  }

  private String hash(String value) { try { byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)); StringBuilder out = new StringBuilder(); for (byte item : digest) out.append(String.format("%02x", item)); return out.toString(); } catch (Exception error) { throw new IllegalStateException(error); } }
  private String required(String value, String field) { if (value == null || value.trim().isEmpty()) throw badRequest(field + "不能为空"); return value.trim(); }
  private String nullable(String value) { return value == null || value.trim().isEmpty() ? null : value.trim(); }
  private ResponseStatusException badRequest(String message) { return new ResponseStatusException(HttpStatus.BAD_REQUEST, message); }
}
