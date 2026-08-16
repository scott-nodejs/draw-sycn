package com.whiteboard.server.auth;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthService auth;
  public AuthController(AuthService auth) { this.auth = auth; }
  @PostMapping("/register") @ResponseStatus(HttpStatus.CREATED) public Map<String, Object> register(@RequestBody JsonNode input) { return auth.register(input); }
  @PostMapping("/login") public Map<String, Object> login(@RequestBody JsonNode input) { return auth.login(input); }
  @GetMapping("/me") public Map<String, Object> me(@RequestHeader("Authorization") String authorization) { return auth.authenticate(token(authorization)); }
  @PostMapping("/logout") @ResponseStatus(HttpStatus.NO_CONTENT) public void logout(@RequestHeader("Authorization") String authorization) { auth.logout(token(authorization)); }
  static String token(String authorization) { return authorization != null && authorization.startsWith("Bearer ") ? authorization.substring(7) : ""; }
}
