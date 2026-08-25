package org.dromara.system.domain;

import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.dromara.common.mybatis.core.domain.BaseEntity;

/** 产品应用，由平台统一维护。 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sys_app")
public class SysApp extends BaseEntity {

    @TableId("app_id")
    private Long appId;
    private String appCode;
    private String appName;
    private String appType;
    private String status;
    private Integer sortNum;
    private String remark;
}
