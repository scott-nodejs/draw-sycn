package org.dromara.system.service;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import cn.hutool.core.convert.Convert;
import lombok.RequiredArgsConstructor;
import org.dromara.common.core.constant.SystemConstants;
import org.dromara.common.core.exception.ServiceException;
import org.dromara.common.satoken.utils.LoginHelper;
import org.dromara.system.domain.SysMenu;
import org.dromara.system.domain.SysTenantMenu;
import org.dromara.system.domain.vo.SysMenuVo;
import org.dromara.system.mapper.SysMenuMapper;
import org.dromara.system.mapper.SysTenantMenuMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** 平台向租户授予菜单，以及租户读取自身可分配菜单。 */
@Service
@RequiredArgsConstructor
public class SysTenantMenuService {

    private final SysTenantMenuMapper tenantMenuMapper;
    private final SysMenuMapper menuMapper;

    public List<SysMenuVo> selectGrantedMenus(String tenantId, Long appId) {
        List<Long> menuIds = tenantMenuMapper.selectObjs(new LambdaQueryWrapper<SysTenantMenu>()
            .select(SysTenantMenu::getMenuId)
            .eq(SysTenantMenu::getTenantId, tenantId)
            .eq(SysTenantMenu::getAppId, appId)
            .and(w -> w.isNull(SysTenantMenu::getExpireTime)
                .or().gt(SysTenantMenu::getExpireTime, LocalDateTime.now())))
            .stream().map(Convert::toLong).toList();
        if (menuIds.isEmpty()) {
            return List.of();
        }
        return menuMapper.selectVoList(new LambdaQueryWrapper<SysMenu>()
            .eq(SysMenu::getAppId, appId)
            .eq(SysMenu::getStatus, SystemConstants.NORMAL)
            .in(SysMenu::getMenuId, menuIds)
            .orderByAsc(SysMenu::getParentId)
            .orderByAsc(SysMenu::getOrderNum));
    }

    public List<SysMenuVo> selectCurrentTenantMenus(Long appId) {
        return selectGrantedMenus(LoginHelper.getTenantId(), appId);
    }

    @Transactional(rollbackFor = Exception.class)
    public void replaceGrant(String tenantId, Long appId, Long[] requestedMenuIds, LocalDateTime expireTime) {
        Set<Long> menuIds = requestedMenuIds == null
            ? Set.of() : new HashSet<>(List.of(requestedMenuIds));
        if (!menuIds.isEmpty()) {
            long validCount = menuMapper.selectCount(new LambdaQueryWrapper<SysMenu>()
                .eq(SysMenu::getAppId, appId)
                .eq(SysMenu::getStatus, SystemConstants.NORMAL)
                .in(SysMenu::getMenuId, menuIds));
            if (validCount != menuIds.size()) {
                throw new ServiceException("租户授权包含其他应用或已停用的菜单");
            }
        }
        tenantMenuMapper.delete(new LambdaQueryWrapper<SysTenantMenu>()
            .eq(SysTenantMenu::getTenantId, tenantId)
            .eq(SysTenantMenu::getAppId, appId));
        for (Long menuId : menuIds) {
            SysTenantMenu grant = new SysTenantMenu();
            grant.setTenantId(tenantId);
            grant.setAppId(appId);
            grant.setMenuId(menuId);
            grant.setSourceType("MANUAL");
            grant.setExpireTime(expireTime);
            grant.setCreateBy(LoginHelper.getUserId());
            grant.setCreateTime(LocalDateTime.now());
            tenantMenuMapper.insert(grant);
        }
    }
}
