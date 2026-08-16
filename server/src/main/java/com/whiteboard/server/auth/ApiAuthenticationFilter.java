package com.whiteboard.server.auth;

import java.io.IOException;
import java.util.Map;
import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletRequestWrapper;
import javax.servlet.http.HttpServletResponse;
import org.springframework.http.HttpMethod;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class ApiAuthenticationFilter extends OncePerRequestFilter {
  private final AuthService auth;
  public ApiAuthenticationFilter(AuthService auth) { this.auth = auth; }
  @Override protected boolean shouldNotFilter(HttpServletRequest request) {
    String path = request.getRequestURI();
    return HttpMethod.OPTIONS.matches(request.getMethod())
      || !path.startsWith("/api/")
      || path.startsWith("/api/auth/")
      || path.startsWith("/api/whiteboard/")
      || (HttpMethod.GET.matches(request.getMethod()) && path.equals("/api/learning-products"));
  }
  @Override protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain) throws ServletException, IOException {
    try {
      Map<String, Object> user = auth.authenticate(AuthController.token(request.getHeader("Authorization")));
      String userId = String.valueOf(user.get("id"));
      String role = String.valueOf(user.get("role"));
      String path = request.getRequestURI();
      if (path.startsWith("/api/teacher/") && !"teacher".equals(role)) {
        throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "当前接口仅限老师账号访问");
      }
      if (path.startsWith("/api/student/") && !"student".equals(role)) {
        throw new org.springframework.web.server.ResponseStatusException(org.springframework.http.HttpStatus.FORBIDDEN, "当前接口仅限学生账号访问");
      }
      HttpServletRequestWrapper wrapped = new HttpServletRequestWrapper(request) {
        @Override public String getHeader(String name) {
          if ("X-User-Id".equalsIgnoreCase(name)) return userId;
          if ("X-User-Role".equalsIgnoreCase(name)) return role;
          return super.getHeader(name);
        }
      };
      wrapped.setAttribute("authenticatedUser", user);
      chain.doFilter(wrapped, response);
    } catch (org.springframework.web.server.ResponseStatusException error) {
      if (request.getHeader("Origin") != null) {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader("Vary", "Origin");
      }
      response.setStatus(error.getStatus().value()); response.setContentType("application/json;charset=UTF-8"); response.getWriter().write("{\"message\":\"" + error.getReason() + "\"}");
    }
  }
}
