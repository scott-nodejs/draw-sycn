package com.bijian.teacheragent.config;

import org.springframework.context.annotation.Configuration; import org.springframework.web.servlet.config.annotation.*;
@Configuration public class CorsConfig implements WebMvcConfigurer { public void addCorsMappings(CorsRegistry registry){registry.addMapping("/api/**").allowedOriginPatterns("*").allowedMethods("GET","POST","OPTIONS");} }
