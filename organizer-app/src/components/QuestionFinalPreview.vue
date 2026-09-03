<script setup lang="ts">
import { computed } from 'vue'
import { optionText,type PresentationBlock,type Question } from '../api'
import AuthenticatedImage from './AuthenticatedImage.vue'
import MathPreview from './MathPreview.vue'

const props=defineProps<{question:Question}>()
const blocks=computed(()=>(props.question.presentationLayout?.blocks||[]).filter(block=>block.kind==='stem'||(block.kind==='options'&&props.question.options?.length)||(block.kind==='figure'&&props.question.figureUrls?.[block.figureIndex||0])))
const hasLayout=computed(()=>blocks.value.length>0)
const contentBottom=computed(()=>Math.min(100,Math.max(20,...blocks.value.map(block=>block.y+(block.height||15)+4))))
const previewHeight=computed(()=>Math.max(140,Math.min(520,(props.question.presentationLayout?.height||360)*contentBottom.value/100)))
const images=computed(()=>props.question.figureUrls||[])
function blockStyle(block:PresentationBlock){return{left:`${block.x}%`,top:`${block.y/contentBottom.value*100}%`,width:`${block.width}%`,height:`${(block.height||15)/contentBottom.value*100}%`}}
</script>

<template>
 <section class="final-preview">
  <div v-if="hasLayout" class="final-layout" :style="{height:`${previewHeight}px`}">
   <div v-for="block in blocks" :key="block.id" class="final-block" :data-kind="block.kind" :style="blockStyle(block)">
    <MathPreview v-if="block.kind==='stem'" :text="question.stem"/>
    <div v-else-if="block.kind==='options'" class="final-options"><span v-for="(option,index) in question.options" :key="index"><b>{{String.fromCharCode(65+index)}}.</b><MathPreview :text="optionText(option,index)"/></span></div>
    <AuthenticatedImage v-else-if="question.figureUrls?.[block.figureIndex||0]" :path="question.figureUrls[block.figureIndex||0]" alt="题目图片"/>
   </div>
  </div>
  <div v-else class="final-default">
   <div class="final-stem"><MathPreview :text="question.stem"/></div>
   <div v-if="images.length" class="final-images"><AuthenticatedImage v-for="path in images" :key="path" :path="path" alt="题目图片"/></div>
   <div v-if="question.options?.length" class="final-options"><span v-for="(option,index) in question.options" :key="index"><b>{{String.fromCharCode(65+index)}}.</b><MathPreview :text="optionText(option,index)"/></span></div>
  </div>
  <div class="final-answer-panel">
   <div><span>答案</span><MathPreview :text="question.answer||'尚未填写答案'"/></div>
   <div><span>解析</span><MathPreview :text="question.analysis||'尚未填写解析'"/></div>
  </div>
 </section>
</template>

<style scoped>
.final-preview{padding-bottom:18px}.final-layout{position:relative;margin:14px 22px 14px;overflow:hidden;border:1px solid #edf0f5;border-radius:8px;background:#fff}.final-block{position:absolute;overflow:hidden;padding:6px;line-height:1.65}.final-block[data-kind=figure]{padding:0}.final-block :deep(img){width:100%;height:100%;object-fit:contain}.final-default{padding:18px 22px 0}.final-stem{font-size:16px;line-height:1.8}.final-images{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px}.final-images :deep(img){max-width:min(420px,100%);max-height:260px;object-fit:contain;border:1px solid #e3e8f0;border-radius:6px}.final-options{display:grid;grid-template-columns:1fr 1fr;gap:10px 22px;margin-top:12px}.final-options span{display:flex;gap:6px;align-items:flex-start}.final-options b{line-height:1.7}.final-answer-panel{display:grid;gap:10px;margin:14px 22px 0}.final-answer-panel>div{border:1px solid #e2e7ef;border-radius:8px;overflow:hidden;background:#fbfcfe}.final-answer-panel span{display:block;padding:7px 10px;background:#f1f4f8;color:#536178;font-size:11px;font-weight:800}.final-answer-panel :deep(.math-preview){min-height:40px;padding:10px 12px;font-size:13px;line-height:1.75;color:#1e2a40}
</style>
