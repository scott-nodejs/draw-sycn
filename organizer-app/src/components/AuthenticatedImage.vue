<script setup lang="ts">
import { onBeforeUnmount,ref,watch } from 'vue'
import { api } from '../api'
const props=defineProps<{path:string;alt?:string}>()
const url=ref(''),failed=ref(false)
function clear(){if(url.value)URL.revokeObjectURL(url.value);url.value=''}
async function load(){clear();failed.value=false;try{url.value=URL.createObjectURL(await api.assetBlob(props.path))}catch{failed.value=true}}
watch(()=>props.path,load,{immediate:true});onBeforeUnmount(clear)
</script>
<template><img v-if="url" :src="url" :alt="alt||'题目图片'"/><span v-else-if="failed" class="secure-image-error">图片加载失败</span><span v-else class="secure-image-loading">加载中</span></template>
