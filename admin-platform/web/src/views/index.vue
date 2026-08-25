<template>
  <div class="dashboard">
    <section class="welcome-card">
      <div>
        <span class="eyebrow">BIJIAN CLOUD ADMIN</span>
        <h1>欢迎回来，{{ displayName }}</h1>
        <p>统一管理租户、组织架构、用户和系统权限。</p>
      </div>
      <div class="welcome-actions">
        <button @click="go('/system/tenant')"><OfficeBuilding />租户管理</button>
        <button class="ghost" @click="go('/system/user')"><User />用户管理</button>
      </div>
    </section>

    <section class="stat-grid">
      <article v-for="item in stats" :key="item.label" class="stat-card" @click="go(item.path)">
        <div class="stat-icon" :style="{ color: item.color, background: item.background }">
          <component :is="item.icon" />
        </div>
        <div class="stat-copy">
          <span>{{ item.label }}</span>
          <strong>{{ loading ? '—' : item.value }}</strong>
          <small>{{ item.description }}</small>
        </div>
        <ArrowRight class="stat-arrow" />
      </article>
    </section>

    <section class="content-grid">
      <article class="panel capability-panel">
        <header>
          <div><span class="panel-kicker">CORE CAPABILITIES</span><h2>管理能力</h2></div>
          <span class="status"><i />系统运行正常</span>
        </header>
        <div class="capability-list">
          <div v-for="(item, index) in capabilities" :key="item.title" class="capability-item">
            <span class="step">0{{ index + 1 }}</span>
            <div><strong>{{ item.title }}</strong><p>{{ item.description }}</p></div>
            <CircleCheckFilled />
          </div>
        </div>
      </article>

      <article class="panel quick-panel">
        <header><div><span class="panel-kicker">QUICK ACCESS</span><h2>常用入口</h2></div></header>
        <div class="quick-grid">
          <button v-for="item in shortcuts" :key="item.title" @click="go(item.path)">
            <span><component :is="item.icon" /></span>
            <strong>{{ item.title }}</strong>
            <small>{{ item.description }}</small>
            <ArrowRight />
          </button>
        </div>
      </article>
    </section>
  </div>
</template>

<script setup name="Index" lang="ts">
import { computed, markRaw, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ArrowRight, CircleCheckFilled, Collection, Key, OfficeBuilding, Tickets, User, UserFilled } from '@element-plus/icons-vue';
import { useUserStore } from '@/store/modules/user';
import { listTenant } from '@/api/system/tenant';
import { listTenantPackage } from '@/api/system/tenantPackage';
import { listUser } from '@/api/system/user';
import { listRole } from '@/api/system/role';

const router = useRouter();
const userStore = useUserStore();
const loading = ref(true);
const displayName = computed(() => userStore.nickname || '管理员');
const go = (path: string) => router.push(path);

const stats = reactive([
  { label: '租户总数', value: 0, description: '当前已接入租户', path: '/system/tenant', icon: markRaw(OfficeBuilding), color: '#2674ff', background: '#edf4ff' },
  { label: '租户套餐', value: 0, description: '可分配权限套餐', path: '/system/tenantPackage', icon: markRaw(Tickets), color: '#7b61ff', background: '#f2efff' },
  { label: '系统用户', value: 0, description: '平台用户总量', path: '/system/user', icon: markRaw(UserFilled), color: '#00a88f', background: '#e9faf6' },
  { label: '权限角色', value: 0, description: '已配置角色数量', path: '/system/role', icon: markRaw(Key), color: '#f19a2a', background: '#fff5e8' }
]);

const capabilities = [
  { title: '租户隔离', description: '为不同机构提供独立的数据与权限边界' },
  { title: '组织管理', description: '统一维护部门、岗位和成员关系' },
  { title: '角色权限', description: '按角色分配菜单与数据访问范围' },
  { title: '系统配置', description: '集中管理字典、参数和基础配置' }
];

const shortcuts = [
  { title: '租户管理', description: '查看与维护机构', path: '/system/tenant', icon: markRaw(OfficeBuilding) },
  { title: '用户管理', description: '账号与组织关系', path: '/system/user', icon: markRaw(User) },
  { title: '角色管理', description: '角色和数据权限', path: '/system/role', icon: markRaw(Key) },
  { title: '字典管理', description: '系统基础字典', path: '/system/dict', icon: markRaw(Collection) }
];

const totalOf = (response: any) => Number(response?.total ?? response?.data?.total ?? response?.rows?.length ?? response?.data?.rows?.length ?? 0);

onMounted(async () => {
  const requests = [listTenant({ pageNum: 1, pageSize: 1 }), listTenantPackage({ pageNum: 1, pageSize: 1 }), listUser({ pageNum: 1, pageSize: 1 }), listRole({ pageNum: 1, pageSize: 1 })];
  const results = await Promise.allSettled(requests);
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') stats[index].value = totalOf(result.value);
  });
  loading.value = false;
});
</script>

<style scoped lang="scss">
.dashboard { min-height: calc(100vh - 84px); padding: 22px; color: #13264a; background: #f5f8fd; }
.welcome-card { display: flex; align-items: center; justify-content: space-between; padding: 26px 30px; border: 1px solid #dce7f8; border-radius: 14px; background: linear-gradient(110deg, #fff 55%, #eaf4ff); box-shadow: 0 8px 24px rgba(37, 91, 159, .06); }
.eyebrow,.panel-kicker { color: #2f80ed; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; }
h1 { margin: 7px 0 5px; font-size: 26px; } p { margin: 0; color: #7a8daa; }
.welcome-actions { display: flex; gap: 10px; button { display: flex; gap: 7px; align-items: center; padding: 11px 17px; color: #fff; border: 0; border-radius: 9px; background: #2878f0; cursor: pointer; svg { width: 17px; } } .ghost { color: #2878f0; border: 1px solid #bad4f8; background: #fff; } }
.stat-grid { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 16px; margin-top: 16px; }
.stat-card { position: relative; display: flex; align-items: center; min-height: 124px; padding: 20px; border: 1px solid #dce6f4; border-radius: 13px; background: #fff; cursor: pointer; transition: .2s; &:hover { transform: translateY(-2px); box-shadow: 0 12px 28px rgba(46,94,155,.09); } }
.stat-icon { display: grid; flex: 0 0 50px; height: 50px; margin-right: 16px; place-items: center; border-radius: 11px; svg { width: 25px; } }
.stat-copy { display: flex; flex-direction: column; span { color: #617795; font-size: 14px; } strong { margin: 4px 0 2px; color: #13264a; font-size: 29px; } small { color: #9aa8bb; } }
.stat-arrow { position: absolute; top: 19px; right: 18px; width: 15px; color: #b0bfd3; }
.content-grid { display: grid; grid-template-columns: 1.2fr .8fr; gap: 16px; margin-top: 16px; }
.panel { padding: 23px; border: 1px solid #dce6f4; border-radius: 13px; background: #fff; header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; } h2 { margin: 4px 0 0; font-size: 20px; } }
.status { color: #55a77c; font-size: 13px; i { display: inline-block; width: 7px; height: 7px; margin-right: 6px; border-radius: 50%; background: #35ba77; box-shadow: 0 0 0 4px #e4f8ed; } }
.capability-list { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.capability-item { display: grid; grid-template-columns: 42px 1fr 20px; align-items: center; gap: 11px; padding: 16px; border-radius: 10px; background: #f7faff; .step { display: grid; height: 38px; color: #2878f0; font-weight: 700; place-items: center; border-radius: 9px; background: #e9f2ff; } strong { font-size: 14px; } p { margin-top: 4px; font-size: 12px; } svg { width: 18px; color: #72a7f5; } }
.quick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; button { position: relative; display: grid; grid-template-columns: 38px 1fr; grid-template-rows: auto auto; padding: 15px; text-align: left; border: 1px solid #e3eaf5; border-radius: 10px; background: #fff; cursor: pointer; span { display: grid; grid-row: 1/3; width: 34px; height: 34px; color: #2878f0; place-items: center; border-radius: 8px; background: #edf4ff; svg { width: 18px; } } strong { font-size: 14px; } small { margin-top: 4px; color: #97a5b9; } > svg { position: absolute; top: 15px; right: 12px; width: 14px; color: #b2bfd0; } } }
@media (max-width: 1100px) { .stat-grid { grid-template-columns: repeat(2,1fr); } .content-grid { grid-template-columns: 1fr; } }
@media (max-width: 650px) { .dashboard { padding: 12px; } .welcome-card { align-items: flex-start; flex-direction: column; gap: 18px; } .stat-grid,.capability-list,.quick-grid { grid-template-columns: 1fr; } }
</style>
