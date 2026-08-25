-- 应用及租户授权迁移（执行一次）
CREATE TABLE sys_app (
    app_id bigint(20) NOT NULL,
    app_code varchar(32) NOT NULL,
    app_name varchar(64) NOT NULL,
    app_type varchar(16) NOT NULL DEFAULT 'BUSINESS',
    status char(1) NOT NULL DEFAULT '0',
    sort_num int(4) NOT NULL DEFAULT 0,
    remark varchar(500) DEFAULT NULL,
    create_dept bigint(20) DEFAULT NULL,
    create_by bigint(20) DEFAULT NULL,
    create_time datetime DEFAULT NULL,
    update_by bigint(20) DEFAULT NULL,
    update_time datetime DEFAULT NULL,
    PRIMARY KEY (app_id),
    UNIQUE KEY uk_sys_app_code (app_code)
) ENGINE=InnoDB COMMENT='产品应用';

INSERT INTO sys_app (app_id, app_code, app_name, app_type, status, sort_num, remark, create_dept, create_by, create_time) VALUES
(1, 'ADMIN', '统一管理后台', 'ADMIN', '0', 1, '平台运营与租户机构共用的后台', 103, 1, NOW()),
(2, 'TEACHER', '老师端', 'BUSINESS', '0', 2, '老师教学业务应用', 103, 1, NOW()),
(3, 'STUDENT', '学生端', 'BUSINESS', '0', 3, '学生学习业务应用', 103, 1, NOW());

ALTER TABLE sys_menu
    ADD COLUMN app_id bigint(20) NOT NULL DEFAULT 1 COMMENT '所属应用ID' AFTER menu_id,
    ADD KEY idx_sys_menu_app_id (app_id);

ALTER TABLE sys_role
    ADD COLUMN app_id bigint(20) NOT NULL DEFAULT 1 COMMENT '所属应用ID' AFTER role_id,
    ADD KEY idx_sys_role_app_id (app_id);

CREATE TABLE sys_tenant_menu (
    tenant_id varchar(20) NOT NULL COMMENT '租户编号',
    app_id bigint(20) NOT NULL COMMENT '应用ID',
    menu_id bigint(20) NOT NULL COMMENT '菜单ID',
    source_type varchar(16) NOT NULL DEFAULT 'MANUAL' COMMENT '授权来源',
    expire_time datetime DEFAULT NULL COMMENT '授权到期时间',
    create_by bigint(20) DEFAULT NULL,
    create_time datetime DEFAULT NULL,
    PRIMARY KEY (tenant_id, app_id, menu_id),
    KEY idx_tenant_menu_app (tenant_id, app_id),
    KEY idx_tenant_menu_menu (menu_id)
) ENGINE=InnoDB COMMENT='租户菜单授权';

-- 默认租户继承当前全部 ADMIN 菜单，保证升级后原后台权限不丢失。
INSERT INTO sys_tenant_menu (tenant_id, app_id, menu_id, source_type, create_by, create_time)
SELECT '000000', 1, menu_id, 'MIGRATION', 1, NOW() FROM sys_menu;
