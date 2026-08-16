import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8788/api'
const TOKEN_KEY = 'zhiwen.student.token'
const USER_ID_KEY = 'zhiwen.student.user-id'

export type StudentUser = { id: string; displayName: string; role: 'student'; mobile?: string }
export type StudentTask = { id: string; type: '试卷'|'单题'; title: string; teacher: string; clazz: string; publish: string; deadline: string; status: string; progress: number; questions: number }
export type StudentPresentationLayout={width:number;height:number;blocks:Array<{id:string;kind:'stem'|'options'|'figure';figureIndex?:number;x:number;y:number;width:number}>}
export type StudentRoomQuestion = { id:string; number:number; type:string; stem:string; options:string[]; figureUrls:string[]; presentationLayout?:StudentPresentationLayout }
export type StudentRoom = { id: string; name: string; teacher: string; clazz: string; time: string; status: string; online: number; currentQuestion?:StudentRoomQuestion|null }
export type StudentClass = { id: string; name: string; grade: string; teacher: string; students: number; recent: string; subject: string }

type RawAssignment = { id:string; contentType:'paper'|'question'; title:string; teacherName?:string; groupName:string; createdAt:string; scheduledAt?:string; status?:string }
type RawRoom = { id:string; title:string; teacherName:string; groupName:string; createdAt:string; status:'open'|'closed'; currentQuestion?:{id:string;number:number;type:string;stem:string;optionsJson?:string;figureUrls?:string[];presentationLayoutJson?:string}|null }
type RawClass = { id:string; name:string; grade:string; memberCount:number; description?:string }
type ApiContextValue = { user:StudentUser|null; ready:boolean; tasks:StudentTask[]; rooms:StudentRoom[]; classes:StudentClass[]; newRoom:StudentRoom|null; dismissNewRoom:()=>void; login:(account:string,password:string)=>Promise<void>; register:(mobile:string,password:string,displayName:string)=>Promise<void>; logout:()=>void; joinClass:(code:string)=>Promise<void>; refresh:()=>Promise<void> }

const ApiContext = createContext<ApiContextValue|null>(null)

async function request<T>(path:string, init:RequestInit = {}):Promise<T> {
  const headers = new Headers(init.headers)
  const token = localStorage.getItem(TOKEN_KEY)
  const userId = localStorage.getItem(USER_ID_KEY)
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (userId) headers.set('X-User-Id', userId)
  const response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  const payload = await response.json().catch(()=>null)
  if (!response.ok) throw new Error(payload?.message || payload?.error || `请求失败 (${response.status})`)
  return payload as T
}

export function StudentApiProvider({children}:{children:ReactNode}) {
  const [user,setUser]=useState<StudentUser|null>(null); const [ready,setReady]=useState(false)
  const [tasks,setTasks]=useState<StudentTask[]>([]); const [rooms,setRooms]=useState<StudentRoom[]>([]); const [classes,setClasses]=useState<StudentClass[]>([])
  const [newRoom,setNewRoom]=useState<StudentRoom|null>(null)
  const knownRoomIds=useRef<Set<string>|null>(null)
  const refresh=useCallback(async()=>{
    const [assignmentRows,roomRows,classRows]=await Promise.all([
      request<RawAssignment[]>('/student/class-assignments'), request<RawRoom[]>('/student/sync-rooms'), request<RawClass[]>('/student/class-groups'),
    ])
    setTasks(assignmentRows.map(item=>({id:item.id,type:item.contentType==='paper'?'试卷':'单题',title:item.title,teacher:item.teacherName||item.groupName,clazz:item.groupName,publish:item.createdAt.replace('T',' ').slice(5,16),deadline:item.scheduledAt?.replace('T',' ').slice(5,16)||'未设置',status:item.status==='scheduled'?'未开始':'进行中',progress:0,questions:item.contentType==='paper'?0:1})))
    const nextRooms=roomRows.filter(item=>item.status==='open').map(item=>({id:item.id,name:item.title,teacher:item.teacherName,clazz:item.groupName,time:item.createdAt.replace('T',' ').slice(5,16),status:'进行中',online:0,currentQuestion:item.currentQuestion?{...item.currentQuestion,options:parseOptions(item.currentQuestion.optionsJson),figureUrls:item.currentQuestion.figureUrls||[],presentationLayout:parsePresentationLayout(item.currentQuestion.presentationLayoutJson)}:null}))
    if(knownRoomIds.current){const added=nextRooms.find(item=>!knownRoomIds.current?.has(item.id));if(added)setNewRoom(added)}
    knownRoomIds.current=new Set(nextRooms.map(item=>item.id))
    setRooms(nextRooms)
    setClasses(classRows.map(item=>({id:item.id,name:item.name,grade:item.grade,teacher:'任课老师',students:item.memberCount,recent:item.description||'暂无最近任务',subject:'课程'})))
  },[])
  useEffect(()=>{const token=localStorage.getItem(TOKEN_KEY);if(!token){setReady(true);return}request<StudentUser>('/auth/me').then(value=>{if(value.role!=='student')throw new Error('请使用学生账号登录');localStorage.setItem(USER_ID_KEY,value.id);setUser(value);return refresh()}).catch(()=>{localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(USER_ID_KEY)}).finally(()=>setReady(true))},[refresh])
  const acceptSession=async(payload:{token:string;user:StudentUser})=>{if(payload.user.role!=='student')throw new Error('请使用学生账号登录');localStorage.setItem(TOKEN_KEY,payload.token);localStorage.setItem(USER_ID_KEY,payload.user.id);setUser(payload.user);await refresh()}
  const login=async(account:string,password:string)=>acceptSession(await request('/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account,password})}))
  const register=async(mobile:string,password:string,displayName:string)=>acceptSession(await request('/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mobile,password,displayName,role:'student'})}))
  const logout=()=>{localStorage.removeItem(TOKEN_KEY);localStorage.removeItem(USER_ID_KEY);setUser(null);setTasks([]);setRooms([]);setClasses([])}
  const joinClass=async(code:string)=>{await request('/student/class-groups/join',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({inviteCode:code})});await refresh()}
  useEffect(()=>{if(!user)return;const poll=()=>void refresh().catch(()=>undefined);const timer=window.setInterval(poll,3000);window.addEventListener('focus',poll);return()=>{window.clearInterval(timer);window.removeEventListener('focus',poll)}},[user,refresh])
  const value=useMemo(()=>({user,ready,tasks,rooms,classes,newRoom,dismissNewRoom:()=>setNewRoom(null),login,register,logout,joinClass,refresh}),[user,ready,tasks,rooms,classes,newRoom,refresh])
  return <ApiContext.Provider value={value}>{children}</ApiContext.Provider>
}

export function useStudentApi(){const value=useContext(ApiContext);if(!value)throw new Error('StudentApiProvider missing');return value}

export async function fetchStudentAsset(path:string):Promise<Blob>{
  const headers=new Headers();const token=localStorage.getItem(TOKEN_KEY);const userId=localStorage.getItem(USER_ID_KEY)
  if(token)headers.set('Authorization',`Bearer ${token}`);if(userId)headers.set('X-User-Id',userId)
  const normalized=path.startsWith('/api/')?path.slice(4):path
  const response=await fetch(`${API_BASE}${normalized.startsWith('/')?normalized:`/${normalized}`}`,{headers})
  if(!response.ok)throw new Error(`题目图片加载失败 (${response.status})`)
  return response.blob()
}

function parseOptions(value?:string):string[]{
  if(!value)return []
  try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed.map(item=>String(item)):[]}
  catch{return []}
}

function parsePresentationLayout(value?:string):StudentPresentationLayout|undefined{
  if(!value)return undefined
  try{const parsed=JSON.parse(value) as StudentPresentationLayout;return parsed&&Array.isArray(parsed.blocks)?parsed:undefined}
  catch{return undefined}
}
