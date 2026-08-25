package org.dromara.system.controller.system;

import cn.dev33.satoken.annotation.SaCheckPermission;
import cn.dev33.satoken.annotation.SaCheckRole;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.constant.TenantConstants;
import org.dromara.common.core.domain.R;
import org.dromara.system.domain.vo.SysMenuVo;
import org.dromara.system.service.SysTenantMenuService;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;

/** 租户功能菜单授权。 */
@Validated
@RestController
@RequiredArgsConstructor
@RequestMapping("/system/tenant/menu")
public class SysTenantMenuController {

    private final SysTenantMenuService tenantMenuService;

    /** 当前租户配置角色时可选择的菜单。 */
    @SaCheckPermission("system:role:list")
    @GetMapping("/current/{appId}")
    public R<List<SysMenuVo>> current(@NotNull @PathVariable Long appId) {
        return R.ok(tenantMenuService.selectCurrentTenantMenus(appId));
    }

    /** 平台查看指定租户的授权。 */
    @SaCheckRole(TenantConstants.SUPER_ADMIN_ROLE_KEY)
    @SaCheckPermission("system:tenant:query")
    @GetMapping("/{tenantId}/{appId}")
    public R<List<SysMenuVo>> list(@NotBlank @PathVariable String tenantId,
                                   @NotNull @PathVariable Long appId) {
        return R.ok(tenantMenuService.selectGrantedMenus(tenantId, appId));
    }

    /** 只有平台超级管理员能够改变租户授权范围。 */
    @SaCheckRole(TenantConstants.SUPER_ADMIN_ROLE_KEY)
    @SaCheckPermission("system:tenant:edit")
    @PutMapping("/{tenantId}/{appId}")
    public R<Void> replace(@NotBlank @PathVariable String tenantId,
                           @NotNull @PathVariable Long appId,
                           @Valid @RequestBody TenantMenuGrantRequest request) {
        tenantMenuService.replaceGrant(tenantId, appId, request.getMenuIds(), request.getExpireTime());
        return R.ok();
    }

    @Data
    public static class TenantMenuGrantRequest {
        private Long[] menuIds;
        private LocalDateTime expireTime;
    }
}
