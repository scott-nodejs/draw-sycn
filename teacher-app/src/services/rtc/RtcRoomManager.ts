import type {RtcCredentials,RtcProvider} from './RtcProvider'
import {TrtcProvider} from './TrtcProvider'

export class RtcRoomManager {
  constructor(private readonly provider:RtcProvider=new TrtcProvider()){}
  connect(credentials:RtcCredentials){return this.provider.joinRoom(credentials)}
  disconnect(){return this.provider.leaveRoom()}
  startMicrophone(){return this.provider.publishMicrophone()}
  stopMicrophone(){return this.provider.unpublishMicrophone()}
  mute(){return this.provider.muteMicrophone()}
  unmute(){return this.provider.unmuteMicrophone()}
  onStateChange(listener:Parameters<RtcProvider['onStateChange']>[0]){return this.provider.onStateChange(listener)}
}
