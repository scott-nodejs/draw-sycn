<script setup lang="ts">
import { nextTick,onBeforeUnmount,ref,watch } from 'vue'
import { LoaderCircle,Move,ScanLine } from 'lucide-vue-next'
import { api,type Paper,type Question } from '../api'

type Region=NonNullable<Question['sourceRegions']>[number]
type DragMode='move'|'n'|'s'|'e'|'w'|'ne'|'nw'|'se'|'sw'
const handles:DragMode[]=['n','s','e','w','ne','nw','se','sw']
const props=defineProps<{paper:Paper;question:Question;recognizing?:boolean}>()
const emit=defineEmits<{(event:'update:regions',regions:NonNullable<Question['sourceRegions']>):void;(event:'recognize'):void}>()
const viewport=ref<HTMLElement|null>(null),pageUrls=ref<string[]>([]),loading=ref(false),loadError=ref('')
let drag:null|{index:number;x:number;y:number;mode:DragMode;region:Region;box:DOMRect}=null

function release(){pageUrls.value.forEach(URL.revokeObjectURL);pageUrls.value=[]}
async function loadPaper(){release();loading.value=true;loadError.value='';try{const urls:string[]=[];for(let page=1;page<=Math.max(1,props.paper.pageCount);page++)urls.push(URL.createObjectURL(await api.pageBlob(props.paper.id,page)));pageUrls.value=urls;await nextTick();window.setTimeout(scrollToQuestion,80)}catch(error){loadError.value=error instanceof Error?error.message:'原卷加载失败'}finally{loading.value=false}}
function regionsForPage(page:number){return(props.question.sourceRegions||[]).map((region,index)=>({region,index})).filter(item=>item.region.pageNumber===page)}
function scrollToQuestion(){const container=viewport.value,target=container?.querySelector<HTMLElement>('.paper-question-region');if(!container||!target)return;container.scrollTo({top:Math.max(0,target.offsetTop+target.parentElement!.offsetTop-container.clientHeight*.25),behavior:'smooth'})}
function startAdjust(event:PointerEvent,index:number,mode:DragMode){const page=(event.currentTarget as HTMLElement).closest<HTMLElement>('.paper-source-page'),region=props.question.sourceRegions?.[index];if(!page||!region)return;event.preventDefault();event.stopPropagation();drag={index,mode,x:event.clientX,y:event.clientY,region:{...region},box:page.getBoundingClientRect()};window.addEventListener('pointermove',adjust);window.addEventListener('pointerup',stopAdjust,{once:true})}
function adjust(event:PointerEvent){if(!drag)return;const dx=(event.clientX-drag.x)/drag.box.width*1000,dy=(event.clientY-drag.y)/drag.box.height*1000,next={...drag.region};if(drag.mode==='move'){const width=next.x1-next.x0,height=next.y1-next.y0;next.x0=clamp(drag.region.x0+dx,0,1000-width);next.y0=clamp(drag.region.y0+dy,0,1000-height);next.x1=next.x0+width;next.y1=next.y0+height}else{if(drag.mode.includes('w'))next.x0=clamp(drag.region.x0+dx,0,next.x1-10);if(drag.mode.includes('e'))next.x1=clamp(drag.region.x1+dx,next.x0+10,1000);if(drag.mode.includes('n'))next.y0=clamp(drag.region.y0+dy,0,next.y1-10);if(drag.mode.includes('s'))next.y1=clamp(drag.region.y1+dy,next.y0+10,1000)}const all=(props.question.sourceRegions||[]).map(item=>({...item}));all[drag.index]=next;emit('update:regions',all)}
function stopAdjust(){drag=null;window.removeEventListener('pointermove',adjust)}
function clamp(value:number,min:number,max:number){return Math.round(Math.max(min,Math.min(max,value)))}
watch(()=>props.paper.id,loadPaper,{immediate:true});watch(()=>props.question.id,()=>nextTick().then(scrollToQuestion));onBeforeUnmount(()=>{release();stopAdjust()})
</script>

<template>
 <div ref="viewport" class="paper-source-preview">
  <div class="paper-source-meta">完整原始试卷 · 共 {{paper.pageCount||1}} 页</div>
  <div v-if="loading" class="paper-source-state"><LoaderCircle class="spin"/>正在加载完整原卷</div>
  <div v-else-if="loadError" class="paper-source-state error-state">{{loadError}}</div>
  <div v-else class="paper-pages">
   <div v-for="(url,pageIndex) in pageUrls" :key="url" class="paper-source-page" :data-page="pageIndex+1">
    <div class="page-number">第 {{pageIndex+1}} 页</div><img :src="url" :alt="`${paper.title} 第 ${pageIndex+1} 页`" draggable="false"/>
    <div v-for="item in regionsForPage(pageIndex+1)" :key="item.index" class="paper-question-region" :style="{left:`${item.region.x0/10}%`,top:`${item.region.y0/10}%`,width:`${(item.region.x1-item.region.x0)/10}%`,height:`${(item.region.y1-item.region.y0)/10}%`}" @pointerdown="startAdjust($event,item.index,'move')">
     <div class="region-float-actions" @pointerdown.stop><span>第 {{question.number}} 题</span><em><Move/>拖动或缩放红框</em><button :disabled="recognizing" @click.stop="emit('recognize')"><ScanLine/>{{recognizing?'识别中':'重新识别'}}</button></div>
     <i v-for="handle in handles" :key="handle" class="resize-handle" :data-handle="handle" @pointerdown="startAdjust($event,item.index,handle)"></i>
    </div>
   </div>
  </div>
 </div>
</template>

<style scoped>
:global(.crop-placeholder){position:relative;overflow:hidden}:global(.crop-placeholder:has(.paper-source-preview)>svg),:global(.crop-placeholder:has(.paper-source-preview)>p),:global(.crop-placeholder:has(.paper-source-preview)>small){display:none}.paper-source-preview{position:absolute;inset:0;overflow:auto;padding:46px 22px 40px;background:#e8edf4;color:#172033}.paper-source-meta{position:sticky;top:-46px;z-index:8;height:42px;margin:0 -22px 18px;padding:13px 20px;background:rgba(255,255,255,.96);border-bottom:1px solid #dce3ec;font-size:12px}.paper-pages{display:flex;flex-direction:column;gap:22px}.paper-source-page{position:relative;width:min(900px,100%);margin:auto;background:#fff;box-shadow:0 5px 24px rgba(35,52,83,.14);line-height:0}.paper-source-page img{display:block;width:100%;height:auto}.page-number{position:absolute;z-index:4;right:10px;top:10px;padding:5px 8px;border-radius:5px;background:#172033bb;color:#fff;font:11px/1 sans-serif}.paper-question-region{position:absolute;z-index:3;border:3px solid #f04438;border-radius:5px;background:rgba(240,68,56,.1);box-shadow:0 0 0 1px rgba(255,255,255,.75),0 3px 12px rgba(240,68,56,.25);cursor:move}.region-float-actions{position:absolute;left:-3px;bottom:calc(100% + 7px);height:34px;display:flex;align-items:center;gap:8px;padding:3px;border-radius:8px;background:#fff;box-shadow:0 5px 18px rgba(32,43,65,.22);font:600 11px/1 Inter,sans-serif;white-space:nowrap;cursor:default;line-height:normal}.region-float-actions>span{height:28px;padding:0 9px;border-radius:6px;background:#f04438;color:#fff;display:flex;align-items:center}.region-float-actions em{display:flex;align-items:center;gap:4px;color:#7b8494;font-style:normal;font-weight:500}.region-float-actions em svg{width:13px}.region-float-actions button{height:28px;padding:0 10px;border:0;border-radius:6px;background:#2864eb;color:#fff;font-weight:700;display:flex;align-items:center;gap:5px}.region-float-actions button svg{width:14px}.region-float-actions button:disabled{opacity:.6;cursor:wait}.resize-handle{position:absolute;width:12px;height:12px;border:2px solid #fff;border-radius:50%;background:#f04438;z-index:2}.resize-handle[data-handle=n]{left:50%;top:-7px;cursor:ns-resize}.resize-handle[data-handle=s]{left:50%;bottom:-7px;cursor:ns-resize}.resize-handle[data-handle=e]{right:-7px;top:50%;cursor:ew-resize}.resize-handle[data-handle=w]{left:-7px;top:50%;cursor:ew-resize}.resize-handle[data-handle=ne]{right:-7px;top:-7px;cursor:nesw-resize}.resize-handle[data-handle=nw]{left:-7px;top:-7px;cursor:nwse-resize}.resize-handle[data-handle=se]{right:-7px;bottom:-7px;cursor:nwse-resize}.resize-handle[data-handle=sw]{left:-7px;bottom:-7px;cursor:nesw-resize}.paper-source-state{height:100%;display:flex;align-items:center;justify-content:center;gap:8px;color:#768197}.paper-source-state svg{width:20px}.error-state{color:#d34d59}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
.region-float-actions :deep(svg){width:14px!important;height:14px!important;min-width:14px!important;max-width:14px!important;max-height:14px!important}.region-float-actions em :deep(svg){width:13px!important;height:13px!important;min-width:13px!important}
</style>
