package org.dromara.system.domain;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/** 平台授予租户的菜单范围。 */
@Data
@TableName("sys_tenant_menu")
public class SysTenantMenu implements Serializable {

    private String tenantId;
    private Long appId;
    private Long menuId;
    private String sourceType;
    private LocalDateTime expireTime;
    private Long createBy;
    private LocalDateTime createTime;
}
