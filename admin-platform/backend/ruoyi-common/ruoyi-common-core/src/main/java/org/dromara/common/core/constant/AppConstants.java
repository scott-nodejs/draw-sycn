package org.dromara.common.core.constant;

/**
 * 产品应用编码。
 *
 * 统一管理后台内部通过角色和租户身份区分平台运营方与机构管理员；
 * 老师端、学生端保持独立的业务应用权限树。
 */
public interface AppConstants {

    Long ADMIN_ID = 1L;
    Long TEACHER_ID = 2L;
    Long STUDENT_ID = 3L;

    String ADMIN = "ADMIN";
    String TEACHER = "TEACHER";
    String STUDENT = "STUDENT";

}
