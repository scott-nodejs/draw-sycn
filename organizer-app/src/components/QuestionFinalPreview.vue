<script setup lang="ts">
import { computed } from 'vue'
import type { PresentationBlock,Question } from '../api'
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
 <div v-if="hasLayout" class="final-layout" :style="{height:`${previewHeight}px`}">
  <div v-for="block in blocks" :key="block.id" class="final-block" :data-kind="block.kind" :style="blockStyle(block)">
   <MathPreview v-if="block.kind==='stem'" :text="question.stem"/>
   <div v-else-if="block.kind==='options'" class="final-options"><span v-for="(option,index) in question.options" :key="index"><b>{{String.fromCharCode(65+index)}}.</b><MathPreview :text="option"/></span></div>
   <AuthenticatedImage v-else-if="question.figureUrls?.[block.figureIndex||0]" :path="question.figureUrls[block.figureIndex||0]" alt="题目图片"/>
  </div>
 </div>
 <div v-else class="final-default">
  <div class="final-stem"><MathPreview :text="question.stem"/></div>
  <div v-if="images.length" class="final-images"><AuthenticatedImage v-for="path in images" :key="path" :path="path" alt="题目图片"/></div>
  <div v-if="question.options?.length" class="final-options"><span v-for="(option,index) in question.options" :key="index"><b>{{String.fromCharCode(65+index)}}.</b><MathPreview :text="option"/></span></div>
 </div>
</template>

<style scoped>
.final-layout{position:relative;margin:14px 22px 18px;overflow:hidden;border:1px solid #edf0f5;border-radius:8px;background:#fff}.final-block{position:absolute;overflow:hidden;padding:6px;line-height:1.65}.final-block[data-kind=figure]{padding:0}.final-block :deep(img){width:100%;height:100%;object-fit:contain}.final-default{padding:18px 22px}.final-stem{font-size:16px;line-height:1.8}.final-images{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px}.final-images :deep(img){max-width:min(420px,100%);max-height:260px;object-fit:contain;border:1px solid #e3e8f0;border-radius:6px}.final-options{display:grid;grid-template-columns:1fr 1fr;gap:10px 22px;margin-top:12px}.final-options span{display:flex;gap:6px;align-items:flex-start}.final-options b{line-height:1.7}
</style>
