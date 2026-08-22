import TRTC from 'trtc-sdk-v5'
import type {RtcConnectionState,RtcCredentials,RtcProvider} from './RtcProvider'

export class TrtcProvider implements RtcProvider {
  private client=TRTC.create()
  private state:RtcConnectionState='DISCONNECTED'
  private listeners=new Set<(state:RtcConnectionState)=>void>()
  constructor(){this.client.on(TRTC.EVENT.CONNECTION_STATE_CHANGED,event=>{if(event.state==='CONNECTED')this.setState('CONNECTED');else if(event.state==='CONNECTING')this.setState(event.isReconnecting?'RECONNECTING':'JOINING');else this.setState('DISCONNECTED')})}

  async joinRoom(credentials:RtcCredentials){
    this.setState('JOINING')
    try{
      await this.client.enterRoom({sdkAppId:credentials.sdkAppId,strRoomId:credentials.roomId,userId:credentials.userId,userSig:credentials.userSig,scene:TRTC.TYPE.SCENE_LIVE,role:credentials.publishAudio?TRTC.TYPE.ROLE_ANCHOR:TRTC.TYPE.ROLE_AUDIENCE,autoReceiveAudio:true,autoReceiveVideo:false})
      this.setState('CONNECTED')
    }catch(error){this.setState('DISCONNECTED');throw error}
  }
  async leaveRoom(){await this.unpublishMicrophone().catch(()=>undefined);await this.client.exitRoom();this.setState('DISCONNECTED')}
  async publishMicrophone(){await this.client.switchRole(TRTC.TYPE.ROLE_ANCHOR);await this.client.startLocalAudio()}
  async unpublishMicrophone(){await this.client.stopLocalAudio().catch(()=>undefined)}
  async muteMicrophone(){await this.client.updateLocalAudio({mute:true})}
  async unmuteMicrophone(){await this.client.updateLocalAudio({mute:false})}
  onStateChange(listener:(state:RtcConnectionState)=>void){this.listeners.add(listener);listener(this.state);return()=>this.listeners.delete(listener)}
  private setState(state:RtcConnectionState){this.state=state;this.listeners.forEach(listener=>listener(state))}
}
