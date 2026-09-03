<script setup lang="ts">
import { computed,onBeforeUnmount,ref,watch } from 'vue'
import { Check,ChevronLeft,ChevronRight,FileText,Folder,LoaderCircle,RefreshCw,Trash2 } from 'lucide-vue-next'
import { api,type Paper } from '../api'

const props=defineProps<{papers:Paper[];selectedId?:string;busy?:boolean}>()
const emit=defineEmits<{(event:'select',paper:Paper):void;(event:'open',paper:Paper):void;(event:'retry',paper:Paper):void;(event:'delete',paper:Paper):void}>()
const selected=computed(()=>props.papers.find(paper=>paper.id===props.selectedId)||props.papers[0]||null)
const pageNumber=ref(1),pageUrl=ref(''),loading=ref(false),loadError=ref('')

const statusLabel=(paper:Paper)=>paper.status==='queued'?'排队中':paper.status==='processing'?'解析中':paper.status==='paused'?'已暂停':paper.status==='failed'?'解析失败':paper.status==='review'?'待校对':'解析完成'
const statusDone=(paper:Paper)=>!['queued','processing','paused','failed'].includes(paper.status)
const timeline=computed(()=>{
 const paper=selected.value
 if(!paper)return[]
 return[
  {label:'导入文件',detail:'文件已上传并建立解析任务',done:true,active:false},
  {label:'页面解析',detail:paper.pageCount?`共 ${paper.pageCount} 页，页面处理完成`:'正在读取和标准化试卷页面',done:paper.progress>=25,active:paper.progress<25&&!['failed','paused'].includes(paper.status)},
  {label:'题目识别',detail:paper.questionCount?`识别题目 ${paper.questionCount} 道`:'正在进行 OCR 与题目结构化',done:statusDone(paper),active:paper.progress>=25&&!statusDone(paper)&&!['failed','paused'].includes(paper.status)}
 ]
})

function clearPage(){if(pageUrl.value.startsWith('blob:'))URL.revokeObjectURL(pageUrl.value);pageUrl.value=''}
async function loadPage(){
 clearPage();loadError.value=''
 const paper=selected.value
 if(!paper||paper.pageCount<1)return
 loading.value=true
 try{
  const location=await api.pageLocation(paper.id,pageNumber.value)
  pageUrl.value=location.url||URL.createObjectURL(await api.pageBlob(paper.id,pageNumber.value))
 }catch(error){loadError.value=error instanceof Error?error.message:'原卷页面加载失败'}finally{loading.value=false}
}
function choose(paper:Paper){pageNumber.value=1;emit('select',paper)}
function previousPage(){if(pageNumber.value>1)pageNumber.value--}
function nextPage(){if(selected.value&&pageNumber.value<selected.value.pageCount)pageNumber.value++}
watch(()=>selected.value?.id,()=>{if(pageNumber.value===1)loadPage();else pageNumber.value=1},{immediate:true})
watch(pageNumber,loadPage)
onBeforeUnmount(clearPage)
</script>

<template>
 <div v-if="selected" class="paper-workspace">
  <aside class="workspace-library">
   <div class="workspace-panel-title"><div><Folder/><b>试卷列表</b></div><span>{{papers.length}}</span></div>
   <div class="workspace-folder"><Folder/><span>{{selected.subject}}</span><small>{{papers.filter(item=>item.subject===selected?.subject).length}}</small></div>
   <div class="workspace-paper-list">
    <button v-for="paper in papers" :key="paper.id" :class="{active:paper.id===selected.id}" @click="choose(paper)">
     <FileText/><span><b>{{paper.title}}</b><small>{{paper.pageCount||'—'}} 页 · {{paper.questionCount}} 题 · {{statusLabel(paper)}}</small></span>
    </button>
   </div>
  </aside>

  <section class="workspace-preview">
   <div class="preview-toolbar"><button title="上一页" :disabled="pageNumber<=1" @click="previousPage"><ChevronLeft/></button><span>第 {{pageNumber}} / {{Math.max(1,selected.pageCount)}} 页</span><button title="下一页" :disabled="pageNumber>=selected.pageCount" @click="nextPage"><ChevronRight/></button></div>
   <div class="preview-canvas">
    <div v-if="loading" class="preview-state"><LoaderCircle class="spin"/><span>正在加载原卷</span></div>
    <div v-else-if="loadError" class="preview-state error"><FileText/><span>{{loadError}}</span><button @click="loadPage">重试</button></div>
    <div v-else-if="!pageUrl" class="preview-state"><FileText/><span>{{selected.status==='queued'?'试卷正在排队，页面尚未生成':'暂无可预览页面'}}</span></div>
    <img v-else :src="pageUrl" :alt="`${selected.title} 第 ${pageNumber} 页`"/>
   </div>
  </section>

  <aside class="workspace-detail">
   <section><span>文件名</span><h3>{{selected.title}}</h3></section>
   <section><span>所在分类</span><div class="folder-path"><Folder/>{{selected.subject}} / {{selected.grade}}</div></section>
   <section><span>导入时间</span><p>{{new Date(selected.createdAt).toLocaleString()}}</p></section>
   <section class="detail-metrics"><div><span>页数</span><b>{{selected.pageCount}}</b></div><div><span>检测题目数</span><b>{{selected.questionCount}}</b></div></section>
   <section><span>解析状态</span><div class="parse-status" :data-status="selected.status"><i></i><b>{{statusLabel(selected)}}</b><em>{{selected.progress}}%</em></div><div class="detail-progress"><i :style="{width:`${selected.progress}%`}"></i></div></section>
   <section class="process-record"><span>处理记录</span><div v-for="item in timeline" :key="item.label" :class="{done:item.done,active:item.active}"><i><Check v-if="item.done"/><LoaderCircle v-else-if="item.active" class="spin"/></i><p><b>{{item.label}}</b><small>{{item.detail}}</small></p></div></section>
   <div class="workspace-actions"><button class="danger" title="删除试卷" :disabled="busy" @click="emit('delete',selected)"><Trash2/></button><button v-if="selected.status==='failed'" :disabled="busy" @click="emit('retry',selected)"><RefreshCw/>重新解析</button><button class="primary" @click="emit('open',selected)">{{['queued','processing','paused'].includes(selected.status)?'查看进度':'查看题目'}}</button></div>
  </aside>
 </div>
 <div v-else class="workspace-empty"><FileText/><b>暂无试卷</b><span>上传试卷后即可在工作台中预览。</span></div>
</template>

<style scoped>
.paper-workspace{height:calc(100vh - 245px);min-height:620px;display:grid;grid-template-columns:290px minmax(440px,1fr) 320px;border:1px solid #dfe6f1;background:#fff;overflow:hidden}.workspace-library,.workspace-detail{min-width:0;background:#fff;overflow:auto}.workspace-library{border-right:1px solid #e6ebf3}.workspace-panel-title{height:58px;padding:0 16px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #e8edf4}.workspace-panel-title>div,.workspace-folder,.folder-path{display:flex;align-items:center;gap:8px}.workspace-panel-title svg,.workspace-folder svg,.folder-path svg{width:17px;height:17px;color:#627189}.workspace-panel-title span,.workspace-folder small{font-size:12px;color:#8b96a9}.workspace-folder{margin:12px 12px 6px;padding:10px;border-radius:6px;background:#f4f7fb;font-size:13px;font-weight:700}.workspace-folder small{margin-left:auto}.workspace-paper-list{padding:4px 10px 18px}.workspace-paper-list button{width:100%;min-height:72px;padding:11px 10px;border:0;border-left:3px solid transparent;background:transparent;display:grid;grid-template-columns:22px 1fr;gap:8px;text-align:left;color:#263349}.workspace-paper-list button:hover{background:#f7f9fc}.workspace-paper-list button.active{border-left-color:#d66b3d;background:#fbf5f1}.workspace-paper-list button>svg{width:18px;height:18px;color:#d35d51;margin-top:2px}.workspace-paper-list span{min-width:0}.workspace-paper-list b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.workspace-paper-list small{display:block;margin-top:7px;color:#8691a3;font-size:11px}.workspace-preview{min-width:0;background:#eef2f7;display:grid;grid-template-rows:48px 1fr}.preview-toolbar{display:flex;align-items:center;justify-content:center;gap:10px;background:#fff;border-bottom:1px solid #dfe6ef}.preview-toolbar button{width:30px;height:30px;padding:0;border:1px solid #dce3ed;background:#fff;display:grid;place-items:center}.preview-toolbar button svg{width:15px}.preview-toolbar button:disabled{opacity:.35}.preview-toolbar span{min-width:92px;text-align:center;font-size:12px;color:#536078}.preview-canvas{overflow:auto;padding:24px;display:flex;align-items:flex-start;justify-content:center}.preview-canvas>img{display:block;width:min(820px,100%);height:auto;background:#fff;box-shadow:0 8px 28px rgba(40,54,79,.16)}.preview-state{align-self:center;min-height:240px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:#7d899d}.preview-state svg{width:28px}.preview-state button{border:1px solid #cfd8e6;background:#fff;padding:7px 12px}.preview-state.error{color:#c65555}.workspace-detail{border-left:1px solid #e2e8f1;padding-bottom:76px;position:relative}.workspace-detail>section{padding:18px;border-bottom:1px solid #edf0f5}.workspace-detail section>span,.detail-metrics span{display:block;margin-bottom:9px;font-size:12px;color:#8a95a7}.workspace-detail h3{font-size:14px;line-height:1.65;margin:0;color:#233047;letter-spacing:0}.workspace-detail p{margin:0;font-size:13px;color:#4c596e}.folder-path{width:max-content;max-width:100%;padding:7px 9px;border:1px solid #dfe5ee;border-radius:5px;font-size:12px}.detail-metrics{display:grid;grid-template-columns:1fr 1fr}.detail-metrics div+div{border-left:1px solid #e5eaf1;padding-left:18px}.detail-metrics b{font-size:20px}.parse-status{display:flex;align-items:center;gap:8px}.parse-status i{width:9px;height:9px;border-radius:50%;background:#2eae7d}.parse-status[data-status=failed] i{background:#dc5964}.parse-status[data-status=processing] i,.parse-status[data-status=queued] i{background:#3978e8}.parse-status em{margin-left:auto;font-style:normal;font-size:12px;color:#7f8a9b}.detail-progress{height:4px;margin-top:12px;background:#e8edf4;overflow:hidden}.detail-progress i{display:block;height:100%;background:#3978e8}.process-record>div{display:grid;grid-template-columns:24px 1fr;gap:9px;padding:8px 0;position:relative}.process-record>div>i{width:20px;height:20px;border:2px solid #ccd5e1;border-radius:50%;display:grid;place-items:center;color:#fff}.process-record>div.done>i{border-color:#35a87e;background:#35a87e}.process-record>div.active>i{border-color:#3978e8;color:#3978e8}.process-record svg{width:12px;height:12px}.process-record p{display:flex;flex-direction:column;gap:4px}.process-record small{font-size:11px;color:#8b95a5}.workspace-actions{position:absolute;left:0;right:0;bottom:0;padding:12px 16px;border-top:1px solid #e5eaf1;background:#fff;display:flex;gap:8px}.workspace-actions button{height:38px;border:1px solid #d7dfeb;background:#fff;display:flex;align-items:center;justify-content:center;gap:6px;padding:0 12px}.workspace-actions button svg{width:16px}.workspace-actions .danger{width:38px;padding:0;color:#c64d58}.workspace-actions .primary{margin-left:auto;border-color:#2864eb;background:#2864eb;color:#fff}.workspace-empty{min-height:480px;border:1px dashed #ced8e6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;color:#8994a6}.workspace-empty svg{width:30px}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
@media(max-width:1250px){.paper-workspace{grid-template-columns:240px minmax(380px,1fr) 280px}}@media(max-width:980px){.paper-workspace{height:auto;grid-template-columns:230px 1fr}.workspace-detail{grid-column:1/-1;border-left:0;border-top:1px solid #e2e8f1;display:grid;grid-template-columns:repeat(3,1fr);padding-bottom:70px}.workspace-detail>section{border-right:1px solid #edf0f5}.process-record{grid-column:span 2}}@media(max-width:720px){.paper-workspace{grid-template-columns:1fr}.workspace-library{max-height:270px;border-right:0;border-bottom:1px solid #e6ebf3}.workspace-preview{min-height:520px}.workspace-detail{display:block}.preview-canvas{padding:12px}}
</style>
