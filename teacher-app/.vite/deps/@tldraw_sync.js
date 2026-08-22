import {
  AssetRecordType,
  AtomMap,
  DocumentRecordType,
  FpsScheduler,
  InstancePresenceRecordType,
  MediaHelpers,
  PageRecordType,
  Result,
  TAB_ID,
  TLDOCUMENT_ID,
  assert,
  assertExists,
  atom,
  clamp,
  computed,
  createTLSchema,
  createTLStore,
  defaultBindingUtils,
  defaultShapeUtils,
  defaultUserPreferences,
  devFreeze,
  exhaustiveSwitchError,
  getDefaultUserPresence,
  getHashForString,
  getOwnProperty,
  getUserPreferences,
  hasOwnProperty,
  import_lodash,
  import_lodash3 as import_lodash2,
  isNativeStructuredClone,
  isSignal,
  objectMapEntries,
  objectMapEntriesIterable,
  objectMapValues,
  react,
  registerTldrawLibraryVersion,
  reverseRecordsDiff,
  squashRecordDiffsMutable,
  structuredClone,
  transact,
  transaction,
  uniqueId,
  useAtom,
  useEvent,
  useReactiveEvent,
  useRefState,
  useShallowObjectIdentity,
  useTLSchemaFromUtils,
  useValue,
  warnOnce
} from "./chunk-N7GIPC2V.js";
import "./chunk-GSNCDK5E.js";
import "./chunk-TPIGX2EH.js";
import "./chunk-FKVNW67S.js";
import {
  require_react
} from "./chunk-32QE7TW2.js";
import {
  __toESM
} from "./chunk-QKQ6FTX6.js";

// node_modules/@tldraw/sync-core/dist-esm/lib/chunk.mjs
var MAX_CLIENT_SENT_MESSAGE_SIZE_BYTES = 1024 * 1024;
var MAX_BYTES_PER_CHAR = 4;
var MAX_SAFE_MESSAGE_SIZE = MAX_CLIENT_SENT_MESSAGE_SIZE_BYTES / MAX_BYTES_PER_CHAR;
function chunk(msg, maxSafeMessageSize = MAX_SAFE_MESSAGE_SIZE) {
  if (msg.length < maxSafeMessageSize) {
    return [msg];
  } else {
    const chunks = [];
    let chunkNumber = 0;
    let offset = msg.length;
    while (offset > 0) {
      const prefix = `${chunkNumber}_`;
      const chunkSize = Math.max(Math.min(maxSafeMessageSize - prefix.length, offset), 1);
      chunks.unshift(prefix + msg.slice(offset - chunkSize, offset));
      offset -= chunkSize;
      chunkNumber++;
    }
    return chunks;
  }
}
var chunkRe = /^(\d+)_(.*)$/s;
var JsonChunkAssembler = class {
  /**
   * Current assembly state - either 'idle' or tracking chunks being received
   */
  state = "idle";
  /**
   * Processes a single message, which can be either a complete JSON object or a chunk.
   * For complete JSON objects (starting with '\{'), parses immediately.
   * For chunks (prefixed with "\{number\}_"), accumulates until all chunks received.
   *
   * @param msg - The message to process, either JSON or chunk format
   * @returns Result object with data/stringified on success, error object on failure, or null for incomplete chunks
   * 	- `\{ data: object, stringified: string \}` - Successfully parsed complete message
   * 	- `\{ error: Error \}` - Parse error or invalid chunk sequence
   * 	- `null` - Chunk received but more chunks expected
   *
   * @example
   * ```ts
   * const assembler = new JsonChunkAssembler()
   *
   * // Complete JSON message
   * const result = assembler.handleMessage('{"key": "value"}')
   * if (result && 'data' in result) {
   *   console.log(result.data) // { key: "value" }
   * }
   *
   * // Chunked message sequence
   * assembler.handleMessage('2_hel') // null - more chunks expected
   * assembler.handleMessage('1_lo ') // null - more chunks expected
   * assembler.handleMessage('0_wor') // { data: "hello wor", stringified: "hello wor" }
   * ```
   */
  handleMessage(msg) {
    if (msg.startsWith("{")) {
      const error = this.state === "idle" ? void 0 : new Error("Unexpected non-chunk message");
      this.state = "idle";
      return error ? { error } : { data: JSON.parse(msg), stringified: msg };
    } else {
      const match = chunkRe.exec(msg);
      if (!match) {
        this.state = "idle";
        return { error: new Error("Invalid chunk: " + JSON.stringify(msg.slice(0, 20) + "...")) };
      }
      const numChunksRemaining = Number(match[1]);
      const data = match[2];
      if (this.state === "idle") {
        this.state = {
          chunksReceived: [data],
          totalChunks: numChunksRemaining + 1
        };
      } else {
        this.state.chunksReceived.push(data);
        if (numChunksRemaining !== this.state.totalChunks - this.state.chunksReceived.length) {
          this.state = "idle";
          return { error: new Error(`Chunks received in wrong order`) };
        }
      }
      if (this.state.chunksReceived.length === this.state.totalChunks) {
        try {
          const stringified = this.state.chunksReceived.join("");
          const data2 = JSON.parse(stringified);
          return { data: data2, stringified };
        } catch (e) {
          return { error: e };
        } finally {
          this.state = "idle";
        }
      }
      return null;
    }
  }
};

// node_modules/@tldraw/sync-core/dist-esm/lib/diff.mjs
var RecordOpType = {
  Put: "put",
  Patch: "patch",
  Remove: "remove"
};
function getNetworkDiff(diff) {
  let res = null;
  for (const [k, v] of objectMapEntries(diff.added)) {
    if (!res) res = {};
    res[k] = [RecordOpType.Put, v];
  }
  for (const [from, to] of objectMapValues(diff.updated)) {
    const diff2 = diffRecord(from, to);
    if (diff2) {
      if (!res) res = {};
      res[to.id] = [RecordOpType.Patch, diff2];
    }
  }
  for (const removed of Object.keys(diff.removed)) {
    if (!res) res = {};
    res[removed] = [RecordOpType.Remove];
  }
  return res;
}
var ValueOpType = {
  Put: "put",
  Delete: "delete",
  Append: "append",
  Patch: "patch"
};
function diffRecord(prev, next, legacyAppendMode = false) {
  return diffObject(prev, next, /* @__PURE__ */ new Set(["props", "meta"]), legacyAppendMode);
}
function diffObject(prev, next, nestedKeys, legacyAppendMode) {
  if (prev === next) {
    return null;
  }
  let result = null;
  for (const key of Object.keys(prev)) {
    if (!(key in next)) {
      if (!result) result = {};
      result[key] = [ValueOpType.Delete];
      continue;
    }
    const prevValue = prev[key];
    const nextValue = next[key];
    if (nestedKeys?.has(key) || Array.isArray(prevValue) && Array.isArray(nextValue) || typeof prevValue === "string" && typeof nextValue === "string") {
      const diff = diffValue(prevValue, nextValue, legacyAppendMode);
      if (diff) {
        if (!result) result = {};
        result[key] = diff;
      }
    } else if (!(0, import_lodash.default)(prevValue, nextValue)) {
      if (!result) result = {};
      result[key] = [ValueOpType.Put, nextValue];
    }
  }
  for (const key of Object.keys(next)) {
    if (!(key in prev)) {
      if (!result) result = {};
      result[key] = [ValueOpType.Put, next[key]];
    }
  }
  return result;
}
function diffValue(valueA, valueB, legacyAppendMode) {
  if (Object.is(valueA, valueB)) return null;
  if (Array.isArray(valueA) && Array.isArray(valueB)) {
    return diffArray(valueA, valueB, legacyAppendMode);
  } else if (typeof valueA === "string" && typeof valueB === "string") {
    if (!legacyAppendMode && valueB.startsWith(valueA)) {
      const appendedText = valueB.slice(valueA.length);
      return [ValueOpType.Append, appendedText, valueA.length];
    }
    return [ValueOpType.Put, valueB];
  } else if (!valueA || !valueB || typeof valueA !== "object" || typeof valueB !== "object") {
    return (0, import_lodash.default)(valueA, valueB) ? null : [ValueOpType.Put, valueB];
  } else {
    const diff = diffObject(valueA, valueB, void 0, legacyAppendMode);
    return diff ? [ValueOpType.Patch, diff] : null;
  }
}
function diffArray(prevArray, nextArray, legacyAppendMode) {
  if (Object.is(prevArray, nextArray)) return null;
  if (prevArray.length === nextArray.length) {
    const maxPatchIndexes = Math.max(prevArray.length / 5, 1);
    const toPatchIndexes = [];
    for (let i = 0; i < prevArray.length; i++) {
      if (!(0, import_lodash.default)(prevArray[i], nextArray[i])) {
        toPatchIndexes.push(i);
        if (toPatchIndexes.length > maxPatchIndexes) {
          return [ValueOpType.Put, nextArray];
        }
      }
    }
    if (toPatchIndexes.length === 0) {
      return null;
    }
    const diff = {};
    for (const i of toPatchIndexes) {
      const prevItem = prevArray[i];
      const nextItem = nextArray[i];
      if (!prevItem || !nextItem) {
        diff[i] = [ValueOpType.Put, nextItem];
      } else if (typeof prevItem === "object" && typeof nextItem === "object") {
        const op = diffValue(prevItem, nextItem, legacyAppendMode);
        if (op) {
          diff[i] = op;
        }
      } else {
        diff[i] = [ValueOpType.Put, nextItem];
      }
    }
    return [ValueOpType.Patch, diff];
  }
  for (let i = 0; i < prevArray.length; i++) {
    if (!(0, import_lodash.default)(prevArray[i], nextArray[i])) {
      return [ValueOpType.Put, nextArray];
    }
  }
  return [ValueOpType.Append, nextArray.slice(prevArray.length), prevArray.length];
}
function applyObjectDiff(object, objectDiff) {
  if (!object || typeof object !== "object") return object;
  const isArray = Array.isArray(object);
  let newObject = void 0;
  const set = (k, v) => {
    if (!newObject) {
      if (isArray) {
        newObject = [...object];
      } else {
        newObject = { ...object };
      }
    }
    if (isArray) {
      newObject[Number(k)] = v;
    } else {
      newObject[k] = v;
    }
  };
  for (const [key, op] of Object.entries(objectDiff)) {
    switch (op[0]) {
      case ValueOpType.Put: {
        const value = op[1];
        if (!(0, import_lodash.default)(object[key], value)) {
          set(key, value);
        }
        break;
      }
      case ValueOpType.Append: {
        const value = op[1];
        const offset = op[2];
        const currentValue = object[key];
        if (Array.isArray(currentValue) && Array.isArray(value) && currentValue.length === offset) {
          set(key, [...currentValue, ...value]);
        } else if (typeof currentValue === "string" && typeof value === "string" && currentValue.length === offset) {
          set(key, currentValue + value);
        }
        break;
      }
      case ValueOpType.Patch: {
        if (object[key] && typeof object[key] === "object") {
          const diff = op[1];
          const patched = applyObjectDiff(object[key], diff);
          if (patched !== object[key]) {
            set(key, patched);
          }
        }
        break;
      }
      case ValueOpType.Delete: {
        if (key in object) {
          if (!newObject) {
            if (isArray) {
              console.error("Can't delete array item yet (this should never happen)");
              newObject = [...object];
            } else {
              newObject = { ...object };
            }
          }
          delete newObject[key];
        }
      }
    }
  }
  return newObject ?? object;
}

// node_modules/@tldraw/sync-core/dist-esm/lib/interval.mjs
function interval(cb, timeout) {
  const i = setInterval(cb, timeout);
  return () => clearInterval(i);
}

// node_modules/@tldraw/sync-core/dist-esm/lib/protocol.mjs
var TLSYNC_PROTOCOL_VERSION = 8;
function getTlsyncProtocolVersion() {
  return TLSYNC_PROTOCOL_VERSION;
}
var TLIncompatibilityReason = {
  ClientTooOld: "clientTooOld",
  ServerTooOld: "serverTooOld",
  InvalidRecord: "invalidRecord",
  InvalidOperation: "invalidOperation"
};

// node_modules/@tldraw/sync-core/dist-esm/lib/TLSyncClient.mjs
var SOLO_MODE_FPS = 1;
var COLLABORATIVE_MODE_FPS = 30;
var TLSyncErrorCloseEventCode = 4099;
var TLSyncErrorCloseEventReason = {
  /** Room or resource not found */
  NOT_FOUND: "NOT_FOUND",
  /** User lacks permission to access the room */
  FORBIDDEN: "FORBIDDEN",
  /** User authentication required or invalid */
  NOT_AUTHENTICATED: "NOT_AUTHENTICATED",
  /** Unexpected server error occurred */
  UNKNOWN_ERROR: "UNKNOWN_ERROR",
  /** Client protocol version too old */
  CLIENT_TOO_OLD: "CLIENT_TOO_OLD",
  /** Server protocol version too old */
  SERVER_TOO_OLD: "SERVER_TOO_OLD",
  /** Client sent invalid or corrupted record data */
  INVALID_RECORD: "INVALID_RECORD",
  /** Client exceeded rate limits */
  RATE_LIMITED: "RATE_LIMITED",
  /** Room has reached maximum capacity */
  ROOM_FULL: "ROOM_FULL"
};
var TLSyncError = class extends Error {
  constructor(message, reason) {
    super(message);
    this.reason = reason;
  }
};
var PING_INTERVAL = 5e3;
var MAX_TIME_TO_WAIT_FOR_SERVER_INTERACTION_BEFORE_RESETTING_CONNECTION = PING_INTERVAL * 2;
function getPresenceOp(lastPushedPresenceState, nextPresence) {
  if (!lastPushedPresenceState && nextPresence) {
    return [RecordOpType.Put, nextPresence];
  }
  if (lastPushedPresenceState && nextPresence) {
    const diff = diffRecord(lastPushedPresenceState, nextPresence);
    if (!diff) return void 0;
    return [RecordOpType.Patch, diff];
  }
  return void 0;
}
var TLSyncClient = class {
  /** The last clock time from the most recent server update */
  lastServerClock = -1;
  lastServerInteractionTimestamp = Date.now();
  /** The queue of in-flight push requests that have not yet been acknowledged by the server */
  pendingPushRequests = [];
  unsentChanges = { nextDiff: void 0, nextPresence: void 0 };
  /**
   * The diff of 'unconfirmed', 'optimistic' changes that have been made locally by the user if we
   * take this diff, reverse it, and apply that to the store, our store will match exactly the most
   * recent state of the server that we know about
   */
  speculativeChanges = {
    added: {},
    updated: {},
    removed: {}
  };
  disposables = [];
  /** Separate scheduler instance for network sync operations */
  fpsScheduler;
  /** Send any unsent push requests to the server */
  sendUnsentChanges;
  /** Schedule a rebase operation */
  scheduleRebase;
  /** @internal */
  store;
  /** @internal */
  socket;
  /** @internal */
  presenceState;
  /** @internal */
  presenceMode;
  // isOnline is true when we have an open socket connection and we have
  // established a connection with the server room (i.e. we have received a 'connect' message)
  /** @internal */
  isConnectedToRoom = false;
  /**
   * The client clock is essentially a counter for push requests Each time a push request is created
   * the clock is incremented. This clock is sent with the push request to the server, and the
   * server returns it with the response so that we can match up the response with the request.
   *
   * The clock may also be used at one point in the future to allow the client to re-send push
   * requests idempotently (i.e. the server will keep track of each client's clock and not execute
   * requests it has already handled), but at the time of writing this is neither needed nor
   * implemented.
   */
  clientClock = 0;
  /**
   * Callback executed immediately after successful connection to sync room.
   * Use this to perform any post-connection setup required for your application,
   * such as initializing default content or updating UI state.
   *
   * @param self - The TLSyncClient instance that connected
   * @param details - Connection details
   *   - isReadonly - Whether the connection is in read-only mode
   */
  onAfterConnect;
  onCustomMessageReceived;
  isDebugging = false;
  debug(...args) {
    if (this.isDebugging) {
      console.debug(...args);
    }
  }
  presenceType;
  didCancel;
  /**
   * Creates a new TLSyncClient instance to manage synchronization with a remote server.
   *
   * @param config - Configuration object for the sync client
   *   - store - The local tldraw store to synchronize
   *   - socket - WebSocket adapter for server communication
   *   - presence - Reactive signal containing current user's presence data
   *   - presenceMode - Optional signal controlling presence sharing (defaults to 'full')
   *   - onLoad - Callback fired when initial sync completes successfully
   *   - onSyncError - Callback fired when sync fails with error reason
   *   - onCustomMessageReceived - Optional handler for custom messages
   *   - onAfterConnect - Optional callback fired after successful connection
   *   - self - The TLSyncClient instance
   *   - details - Connection details including readonly status
   *   - didCancel - Optional function to check if sync should be cancelled
   */
  constructor(config) {
    this.didCancel = config.didCancel;
    this.presenceType = config.store.scopedTypes.presence.values().next().value ?? null;
    this.fpsScheduler = new FpsScheduler(COLLABORATIVE_MODE_FPS);
    this.sendUnsentChanges = this.fpsScheduler.fpsThrottle(() => {
      this.debug("sending unsent changes", {
        isConnectedToRoom: this.isConnectedToRoom,
        unsentChanges: this.unsentChanges
      });
      if (!this.isConnectedToRoom || this.store.isPossiblyCorrupted()) {
        return;
      }
      if (!this.unsentChanges.nextDiff && !this.unsentChanges.nextPresence) {
        return;
      }
      const diff = this.unsentChanges.nextDiff ? getNetworkDiff(this.unsentChanges.nextDiff) ?? void 0 : void 0;
      const presence = this.unsentChanges.nextPresence ? getPresenceOp(this.lastPushedPresenceState, this.unsentChanges.nextPresence) : void 0;
      if (!diff && !presence) {
        return;
      }
      const pushRequest = {
        type: "push",
        clientClock: this.clientClock,
        diff,
        presence
      };
      this.debug("sending push request", pushRequest);
      this.socket.sendMessage(pushRequest);
      if (this.unsentChanges.nextPresence) {
        this.lastPushedPresenceState = this.unsentChanges.nextPresence;
      }
      this.clientClock++;
      this.pendingPushRequests.push(pushRequest);
      this.unsentChanges.nextDiff = void 0;
      this.unsentChanges.nextPresence = void 0;
    });
    this.scheduleRebase = this.fpsScheduler.fpsThrottle(this.rebase);
    if (typeof window !== "undefined") {
      ;
      window.tlsync = this;
    }
    this.store = config.store;
    this.socket = config.socket;
    this.onAfterConnect = config.onAfterConnect;
    this.onCustomMessageReceived = config.onCustomMessageReceived;
    let didLoad = false;
    this.presenceState = config.presence;
    this.presenceMode = config.presenceMode;
    this.disposables.push(
      // when local 'user' changes are made, send them to the server
      // or stash them locally in offline mode
      this.store.listen(
        ({ changes }) => {
          if (this.didCancel?.()) return this.close();
          this.debug("received store changes", { changes });
          this.push(changes);
        },
        { source: "user", scope: "document" }
      ),
      // when the server sends us events, handle them
      this.socket.onReceiveMessage((msg) => {
        if (this.didCancel?.()) return this.close();
        this.debug("received message from server", msg);
        this.handleServerEvent(msg);
        if (!didLoad) {
          didLoad = true;
          config.onLoad(this);
        }
      }),
      // handle switching between online and offline
      this.socket.onStatusChange((ev) => {
        if (this.didCancel?.()) return this.close();
        this.debug("socket status changed", ev.status);
        if (ev.status === "online") {
          this.sendConnectMessage();
        } else {
          this.resetConnection();
          if (ev.status === "error") {
            didLoad = true;
            config.onSyncError(ev.reason);
            this.close();
          }
        }
      }),
      // Send a ping every PING_INTERVAL ms while online
      interval(() => {
        if (this.didCancel?.()) return this.close();
        this.debug("ping loop", { isConnectedToRoom: this.isConnectedToRoom });
        if (!this.isConnectedToRoom) return;
        try {
          this.socket.sendMessage({ type: "ping" });
        } catch (error) {
          console.warn("ping failed, resetting", error);
          this.resetConnection();
        }
      }, PING_INTERVAL),
      // Check the server connection health, reset the connection if needed
      interval(() => {
        if (this.didCancel?.()) return this.close();
        this.debug("health check loop", { isConnectedToRoom: this.isConnectedToRoom });
        if (!this.isConnectedToRoom) return;
        const timeSinceLastServerInteraction = Date.now() - this.lastServerInteractionTimestamp;
        if (timeSinceLastServerInteraction < MAX_TIME_TO_WAIT_FOR_SERVER_INTERACTION_BEFORE_RESETTING_CONNECTION) {
          this.debug("health check passed", { timeSinceLastServerInteraction });
          return;
        }
        console.warn(`Haven't heard from the server in a while, resetting connection...`);
        this.resetConnection();
      }, PING_INTERVAL * 2)
    );
    if (this.presenceState) {
      this.disposables.push(
        react("pushPresence", () => {
          if (this.didCancel?.()) return this.close();
          const mode = this.presenceMode?.get();
          this.fpsScheduler.updateTargetFps(this.getSyncFps());
          if (mode !== "full") return;
          this.pushPresence(this.presenceState.get());
        })
      );
    }
    if (this.socket.connectionStatus === "online") {
      this.sendConnectMessage();
    }
  }
  /** @internal */
  latestConnectRequestId = null;
  /**
   * This is the first message that is sent over a newly established socket connection. And we need
   * to wait for the response before this client can be used.
   */
  sendConnectMessage() {
    if (this.isConnectedToRoom) {
      console.error("sendConnectMessage called while already connected");
      return;
    }
    this.debug("sending connect message");
    this.latestConnectRequestId = uniqueId();
    this.socket.sendMessage({
      type: "connect",
      connectRequestId: this.latestConnectRequestId,
      schema: this.store.schema.serialize(),
      protocolVersion: getTlsyncProtocolVersion(),
      lastServerClock: this.lastServerClock
    });
  }
  /** Switch to offline mode */
  resetConnection(hard = false) {
    this.debug("resetting connection");
    if (hard) {
      this.lastServerClock = 0;
    }
    const keys = Object.keys(this.store.serialize("presence"));
    if (keys.length > 0) {
      this.store.mergeRemoteChanges(() => {
        this.store.remove(keys);
      });
    }
    this.lastPushedPresenceState = null;
    this.isConnectedToRoom = false;
    this.pendingPushRequests = [];
    this.incomingDiffBuffer = [];
    this.unsentChanges.nextDiff = void 0;
    this.unsentChanges.nextPresence = void 0;
    if (this.socket.connectionStatus === "online") {
      this.socket.restart();
    }
  }
  /**
   * Invoked when the socket connection comes online, either for the first time or as the result of
   * a reconnect. The goal is to rebase on the server's state and fire off a new push request for
   * any local changes that were made while offline.
   */
  didReconnect(event) {
    this.debug("did reconnect", event);
    if (event.connectRequestId !== this.latestConnectRequestId) {
      return;
    }
    this.latestConnectRequestId = null;
    if (this.isConnectedToRoom) {
      console.error("didReconnect called while already connected");
      this.resetConnection(true);
      return;
    }
    if (this.pendingPushRequests.length > 0) {
      console.error("pendingPushRequests should already be empty when we reconnect");
      this.resetConnection(true);
      return;
    }
    transact(() => {
      const stashedChanges = this.speculativeChanges;
      this.speculativeChanges = { added: {}, updated: {}, removed: {} };
      this.store.mergeRemoteChanges(() => {
        const wipeDiff = {};
        const wipeAll = event.hydrationType === "wipe_all";
        if (!wipeAll) {
          this.store.applyDiff(reverseRecordsDiff(stashedChanges), { runCallbacks: false });
        }
        for (const [id, record] of objectMapEntries(this.store.serialize("all"))) {
          if (wipeAll && this.store.scopedTypes.document.has(record.typeName) || record.typeName === this.presenceType) {
            wipeDiff[id] = [RecordOpType.Remove];
          }
        }
        this.applyNetworkDiff({ ...wipeDiff, ...event.diff }, true);
        this.isConnectedToRoom = true;
        const networkDiff = getNetworkDiff(stashedChanges);
        if (!networkDiff) return;
        const speculativeChanges = this.store.filterChangesByScope(
          this.store.extractingChanges(() => {
            this.applyNetworkDiff(networkDiff, true);
          }),
          "document"
        );
        if (speculativeChanges) this.push(speculativeChanges);
      });
      this.onAfterConnect?.(this, { isReadonly: event.isReadonly });
      const presence = this.presenceState?.get();
      if (presence) {
        this.pushPresence(presence);
      }
    });
    this.lastServerClock = event.serverClock;
  }
  incomingDiffBuffer = [];
  /** Handle events received from the server */
  handleServerEvent(event) {
    this.debug("received server event", event);
    this.lastServerInteractionTimestamp = Date.now();
    switch (event.type) {
      case "connect":
        this.didReconnect(event);
        break;
      // legacy v4 events
      case "patch":
      case "push_result":
        if (!this.isConnectedToRoom) break;
        this.incomingDiffBuffer.push(event);
        this.scheduleRebase();
        break;
      case "data":
        if (!this.isConnectedToRoom) break;
        this.incomingDiffBuffer.push(...event.data);
        this.scheduleRebase();
        break;
      case "incompatibility_error":
        console.error("incompatibility error is legacy and should no longer be sent by the server");
        break;
      case "pong":
        break;
      case "custom":
        this.onCustomMessageReceived?.call(null, event.data);
        break;
      default:
        exhaustiveSwitchError(event);
    }
  }
  /**
   * Closes the sync client and cleans up all resources.
   *
   * Call this method when you no longer need the sync client to prevent
   * memory leaks and close the WebSocket connection. After calling close(),
   * the client cannot be reused.
   *
   * @example
   * ```ts
   * // Clean shutdown
   * syncClient.close()
   * ```
   */
  close() {
    this.debug("closing");
    this.disposables.forEach((dispose) => dispose());
    this.sendUnsentChanges.cancel?.();
    this.scheduleRebase.cancel?.();
  }
  lastPushedPresenceState = null;
  pushPresence(nextPresence) {
    this.store._flushHistory();
    if (!this.isConnectedToRoom) {
      return;
    }
    this.unsentChanges.nextPresence = nextPresence;
    this.sendUnsentChanges();
  }
  /** Push a change to the server, or stash it locally if we're offline */
  push(change) {
    this.debug("push", change);
    squashRecordDiffsMutable(this.speculativeChanges, [change]);
    if (!this.isConnectedToRoom) return;
    if (!this.unsentChanges.nextDiff) {
      this.unsentChanges.nextDiff = structuredClone(change);
    } else {
      squashRecordDiffsMutable(this.unsentChanges.nextDiff, [change]);
    }
    this.sendUnsentChanges();
  }
  /** Get the target FPS for network operations based on presence mode */
  getSyncFps() {
    return this.presenceMode?.get() === "solo" ? SOLO_MODE_FPS : COLLABORATIVE_MODE_FPS;
  }
  /**
   * Applies a 'network' diff to the store this does value-based equality checking so that if the
   * data is the same (as opposed to merely identical with ===), then no change is made and no
   * changes will be propagated back to store listeners
   */
  applyNetworkDiff(diff, runCallbacks) {
    this.debug("applyNetworkDiff", diff);
    const changes = { added: {}, updated: {}, removed: {} };
    let hasChanges = false;
    for (const [id, op] of objectMapEntries(diff)) {
      if (op[0] === RecordOpType.Put) {
        const existing = this.store.get(id);
        if (existing && !(0, import_lodash.default)(existing, op[1])) {
          hasChanges = true;
          changes.updated[id] = [existing, op[1]];
        } else {
          hasChanges = true;
          changes.added[id] = op[1];
        }
      } else if (op[0] === RecordOpType.Patch) {
        const record = this.store.get(id);
        if (!record) {
          continue;
        }
        const patched = applyObjectDiff(record, op[1]);
        hasChanges = true;
        changes.updated[id] = [record, patched];
      } else if (op[0] === RecordOpType.Remove) {
        if (this.store.has(id)) {
          hasChanges = true;
          changes.removed[id] = this.store.get(id);
        }
      }
    }
    if (hasChanges) {
      this.store.applyDiff(changes, { runCallbacks });
    }
  }
  // eslint-disable-next-line local/prefer-class-methods
  rebase = () => {
    this.store._flushHistory();
    if (this.incomingDiffBuffer.length === 0) return;
    const diffs = this.incomingDiffBuffer;
    this.incomingDiffBuffer = [];
    try {
      this.store.mergeRemoteChanges(() => {
        this.store.applyDiff(reverseRecordsDiff(this.speculativeChanges), { runCallbacks: false });
        for (const diff of diffs) {
          if (diff.type === "patch") {
            this.applyNetworkDiff(diff.diff, true);
            continue;
          }
          if (this.pendingPushRequests.length === 0) {
            throw new Error("Received push_result but there are no pending push requests");
          }
          if (this.pendingPushRequests[0].clientClock !== diff.clientClock) {
            throw new Error(
              "Received push_result for a push request that is not at the front of the queue"
            );
          }
          if (diff.action === "discard") {
            this.pendingPushRequests.shift();
          } else if (diff.action === "commit") {
            const request = this.pendingPushRequests.shift();
            if ("diff" in request && request.diff) {
              this.applyNetworkDiff(request.diff, true);
            }
          } else {
            this.applyNetworkDiff(diff.action.rebaseWithDiff, true);
            this.pendingPushRequests.shift();
          }
        }
        try {
          this.speculativeChanges = this.store.extractingChanges(() => {
            for (const request of this.pendingPushRequests) {
              if (!("diff" in request) || !request.diff) continue;
              this.applyNetworkDiff(request.diff, true);
            }
            if (!this.unsentChanges.nextDiff) return;
            const diff = getNetworkDiff(this.unsentChanges.nextDiff);
            if (!diff) return;
            this.applyNetworkDiff(diff, true);
          });
        } catch (e) {
          console.error(e);
          this.speculativeChanges = { added: {}, updated: {}, removed: {} };
          this.resetConnection();
        }
      });
      this.lastServerClock = diffs.at(-1)?.serverClock ?? this.lastServerClock;
    } catch (e) {
      console.error(e);
      this.store.ensureStoreIsUsable();
      this.resetConnection();
    }
  };
};

// node_modules/@tldraw/sync-core/dist-esm/lib/ClientWebSocketAdapter.mjs
function listenTo(target, event, handler) {
  target.addEventListener(event, handler);
  return () => {
    target.removeEventListener(event, handler);
  };
}
function debug(...args) {
  if (typeof window !== "undefined" && window.__tldraw_socket_debug) {
    const now = /* @__PURE__ */ new Date();
    console.log(
      `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}.${now.getMilliseconds()}`,
      ...args
      //, new Error().stack
    );
  }
}
var ClientWebSocketAdapter = class {
  _ws = null;
  isDisposed = false;
  /** @internal */
  _reconnectManager;
  /**
   * Permanently closes the WebSocket adapter and disposes of all resources.
   * Once closed, the adapter cannot be reused and should be discarded.
   * This method is idempotent - calling it multiple times has no additional effect.
   */
  // TODO: .close should be a project-wide interface with a common contract (.close()d thing
  //       can only be garbage collected, and can't be used anymore)
  close() {
    this.isDisposed = true;
    this._reconnectManager.close();
    this._ws?.close();
  }
  /**
   * Creates a new ClientWebSocketAdapter instance.
   *
   * @param getUri - Function that returns the WebSocket URI to connect to.
   *                 Can return a string directly or a Promise that resolves to a string.
   *                 This function is called each time a connection attempt is made,
   *                 allowing for dynamic URI generation (e.g., for authentication tokens).
   */
  constructor(getUri) {
    this._reconnectManager = new ReconnectManager(this, getUri);
  }
  _handleConnect() {
    debug("handleConnect");
    this._connectionStatus.set("online");
    this.statusListeners.forEach((cb) => cb({ status: "online" }));
    this._reconnectManager.connected();
  }
  _handleDisconnect(reason, closeCode, didOpen, closeReason) {
    closeReason = closeReason || TLSyncErrorCloseEventReason.UNKNOWN_ERROR;
    debug("handleDisconnect", {
      currentStatus: this.connectionStatus,
      closeCode,
      reason
    });
    let newStatus;
    switch (reason) {
      case "closed":
        if (closeCode === TLSyncErrorCloseEventCode) {
          newStatus = "error";
        } else {
          newStatus = "offline";
        }
        break;
      case "manual":
        newStatus = "offline";
        break;
    }
    if (closeCode === 1006 && !didOpen) {
      warnOnce(
        "Could not open WebSocket connection. This might be because you're trying to load a URL that doesn't support websockets. Check the URL you're trying to connect to."
      );
    }
    if (
      // it the status changed
      this.connectionStatus !== newStatus && // ignore errors if we're already in the offline state
      !(newStatus === "error" && this.connectionStatus === "offline")
    ) {
      this._connectionStatus.set(newStatus);
      this.statusListeners.forEach(
        (cb) => cb(newStatus === "error" ? { status: "error", reason: closeReason } : { status: newStatus })
      );
    }
    this._reconnectManager.disconnected();
  }
  _setNewSocket(ws) {
    assert(!this.isDisposed, "Tried to set a new websocket on a disposed socket");
    assert(
      this._ws === null || this._ws.readyState === WebSocket.CLOSED || this._ws.readyState === WebSocket.CLOSING,
      `Tried to set a new websocket in when the existing one was ${this._ws?.readyState}`
    );
    let didOpen = false;
    ws.onopen = () => {
      debug("ws.onopen");
      assert(
        this._ws === ws,
        "sockets must only be orphaned when they are CLOSING or CLOSED, so they can't open"
      );
      didOpen = true;
      this._handleConnect();
    };
    ws.onclose = (event) => {
      debug("ws.onclose", event);
      if (this._ws === ws) {
        this._handleDisconnect("closed", event.code, didOpen, event.reason);
      } else {
        debug("ignoring onclose for an orphaned socket");
      }
    };
    ws.onerror = (event) => {
      debug("ws.onerror", event);
      if (this._ws === ws) {
        this._handleDisconnect("closed");
      } else {
        debug("ignoring onerror for an orphaned socket");
      }
    };
    ws.onmessage = (ev) => {
      assert(
        this._ws === ws,
        "sockets must only be orphaned when they are CLOSING or CLOSED, so they can't receive messages"
      );
      const parsed = JSON.parse(ev.data.toString());
      this.messageListeners.forEach((cb) => cb(parsed));
    };
    this._ws = ws;
  }
  _closeSocket() {
    if (this._ws === null) return;
    this._ws.close();
    this._ws = null;
    this._handleDisconnect("manual");
  }
  // TLPersistentClientSocket stuff
  _connectionStatus = atom(
    "websocket connection status",
    "initial"
  );
  /**
   * Gets the current connection status of the WebSocket.
   *
   * @returns The current connection status: 'online', 'offline', or 'error'
   */
  // eslint-disable-next-line no-restricted-syntax
  get connectionStatus() {
    const status = this._connectionStatus.get();
    return status === "initial" ? "offline" : status;
  }
  /**
   * Sends a message to the server through the WebSocket connection.
   * Messages are automatically chunked if they exceed size limits.
   *
   * @param msg - The message to send to the server
   *
   * @example
   * ```ts
   * adapter.sendMessage({
   *   type: 'push',
   *   diff: { 'shape:abc123': [2, { x: [1, 150] }] }
   * })
   * ```
   */
  sendMessage(msg) {
    assert(!this.isDisposed, "Tried to send message on a disposed socket");
    if (!this._ws) return;
    if (this.connectionStatus === "online") {
      const chunks = chunk(JSON.stringify(msg));
      for (const part of chunks) {
        this._ws.send(part);
      }
    } else {
      console.warn("Tried to send message while " + this.connectionStatus);
    }
  }
  messageListeners = /* @__PURE__ */ new Set();
  /**
   * Registers a callback to handle incoming messages from the server.
   *
   * @param cb - Callback function that will be called with each received message
   * @returns A cleanup function to remove the message listener
   *
   * @example
   * ```ts
   * const unsubscribe = adapter.onReceiveMessage((message) => {
   *   switch (message.type) {
   *     case 'connect':
   *       console.log('Connected to room')
   *       break
   *     case 'data':
   *       console.log('Received data:', message.diff)
   *       break
   *   }
   * })
   *
   * // Later, remove the listener
   * unsubscribe()
   * ```
   */
  onReceiveMessage(cb) {
    assert(!this.isDisposed, "Tried to add message listener on a disposed socket");
    this.messageListeners.add(cb);
    return () => {
      this.messageListeners.delete(cb);
    };
  }
  statusListeners = /* @__PURE__ */ new Set();
  /**
   * Registers a callback to handle connection status changes.
   *
   * @param cb - Callback function that will be called when the connection status changes
   * @returns A cleanup function to remove the status listener
   *
   * @example
   * ```ts
   * const unsubscribe = adapter.onStatusChange((status) => {
   *   if (status.status === 'error') {
   *     console.error('Connection error:', status.reason)
   *   } else {
   *     console.log('Status changed to:', status.status)
   *   }
   * })
   *
   * // Later, remove the listener
   * unsubscribe()
   * ```
   */
  onStatusChange(cb) {
    assert(!this.isDisposed, "Tried to add status listener on a disposed socket");
    this.statusListeners.add(cb);
    return () => {
      this.statusListeners.delete(cb);
    };
  }
  /**
   * Manually restarts the WebSocket connection.
   * This closes the current connection (if any) and attempts to establish a new one.
   * Useful for implementing connection loss detection and recovery.
   *
   * @example
   * ```ts
   * // Restart connection after detecting it's stale
   * if (lastPongTime < Date.now() - 30000) {
   *   adapter.restart()
   * }
   * ```
   */
  restart() {
    assert(!this.isDisposed, "Tried to restart a disposed socket");
    debug("restarting");
    this._closeSocket();
    this._reconnectManager.maybeReconnected();
  }
};
var ACTIVE_MIN_DELAY = 500;
var ACTIVE_MAX_DELAY = 2e3;
var INACTIVE_MIN_DELAY = 1e3;
var INACTIVE_MAX_DELAY = 1e3 * 60 * 5;
var DELAY_EXPONENT = 1.5;
var ATTEMPT_TIMEOUT = 1e3;
var ReconnectManager = class {
  /**
   * Creates a new ReconnectManager instance.
   *
   * socketAdapter - The ClientWebSocketAdapter instance to manage
   * getUri - Function that returns the WebSocket URI for connection attempts
   */
  constructor(socketAdapter, getUri) {
    this.socketAdapter = socketAdapter;
    this.getUri = getUri;
    this.subscribeToReconnectHints();
    this.disposables.push(
      listenTo(window, "offline", () => {
        debug("window went offline");
        this.socketAdapter._closeSocket();
      })
    );
    this.state = "pendingAttempt";
    this.intendedDelay = ACTIVE_MIN_DELAY;
    this.scheduleAttempt();
  }
  isDisposed = false;
  disposables = [
    () => {
      if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
      if (this.recheckConnectingTimeout) clearTimeout(this.recheckConnectingTimeout);
    }
  ];
  reconnectTimeout = null;
  recheckConnectingTimeout = null;
  lastAttemptStart = null;
  intendedDelay = ACTIVE_MIN_DELAY;
  state;
  subscribeToReconnectHints() {
    this.disposables.push(
      listenTo(window, "online", () => {
        debug("window went online");
        this.maybeReconnected();
      }),
      listenTo(document, "visibilitychange", () => {
        if (!document.hidden) {
          debug("document became visible");
          this.maybeReconnected();
        }
      })
    );
    if (Object.prototype.hasOwnProperty.call(navigator, "connection")) {
      const connection = navigator["connection"];
      this.disposables.push(
        listenTo(connection, "change", () => {
          debug("navigator.connection change");
          this.maybeReconnected();
        })
      );
    }
  }
  scheduleAttempt() {
    assert(this.state === "pendingAttempt");
    debug("scheduling a connection attempt");
    Promise.resolve(this.getUri()).then((uri) => {
      if (this.state !== "pendingAttempt" || this.isDisposed) return;
      assert(
        this.socketAdapter._ws?.readyState !== WebSocket.OPEN,
        "There should be no connection attempts while already connected"
      );
      this.lastAttemptStart = Date.now();
      this.socketAdapter._setNewSocket(new WebSocket(httpToWs(uri)));
      this.state = "pendingAttemptResult";
    });
  }
  getMaxDelay() {
    return document.hidden ? INACTIVE_MAX_DELAY : ACTIVE_MAX_DELAY;
  }
  getMinDelay() {
    return document.hidden ? INACTIVE_MIN_DELAY : ACTIVE_MIN_DELAY;
  }
  clearReconnectTimeout() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }
  clearRecheckConnectingTimeout() {
    if (this.recheckConnectingTimeout) {
      clearTimeout(this.recheckConnectingTimeout);
      this.recheckConnectingTimeout = null;
    }
  }
  /**
   * Checks if reconnection should be attempted and initiates it if appropriate.
   * This method is called in response to network events, tab visibility changes,
   * and other hints that connectivity may have been restored.
   *
   * The method intelligently handles various connection states:
   * - Already connected: no action needed
   * - Currently connecting: waits or retries based on attempt age
   * - Disconnected: initiates immediate reconnection attempt
   *
   * @example
   * ```ts
   * // Called automatically on network/visibility events, but can be called manually
   * manager.maybeReconnected()
   * ```
   */
  maybeReconnected() {
    debug("ReconnectManager.maybeReconnected");
    this.clearRecheckConnectingTimeout();
    if (this.socketAdapter._ws?.readyState === WebSocket.OPEN) {
      debug("ReconnectManager.maybeReconnected: already connected");
      return;
    }
    if (this.socketAdapter._ws?.readyState === WebSocket.CONNECTING) {
      debug("ReconnectManager.maybeReconnected: connecting");
      assert(
        this.lastAttemptStart,
        "ReadyState=CONNECTING without lastAttemptStart should be impossible"
      );
      const sinceLastStart = Date.now() - this.lastAttemptStart;
      if (sinceLastStart < ATTEMPT_TIMEOUT) {
        debug("ReconnectManager.maybeReconnected: connecting, rechecking later");
        this.recheckConnectingTimeout = setTimeout(
          () => this.maybeReconnected(),
          ATTEMPT_TIMEOUT - sinceLastStart
        );
      } else {
        debug("ReconnectManager.maybeReconnected: connecting, but for too long, retry now");
        this.clearRecheckConnectingTimeout();
        this.socketAdapter._closeSocket();
      }
      return;
    }
    debug("ReconnectManager.maybeReconnected: closing/closed/null, retry now");
    this.intendedDelay = ACTIVE_MIN_DELAY;
    this.disconnected();
  }
  /**
   * Handles disconnection events and schedules reconnection attempts with exponential backoff.
   * This method is called when the WebSocket connection is lost or fails to establish.
   *
   * It implements intelligent delay calculation based on:
   * - Previous attempt timing
   * - Current tab visibility (active vs inactive delays)
   * - Exponential backoff for repeated failures
   *
   * @example
   * ```ts
   * // Called automatically when connection is lost
   * // Schedules reconnection with appropriate delay
   * manager.disconnected()
   * ```
   */
  disconnected() {
    debug("ReconnectManager.disconnected");
    if (this.socketAdapter._ws?.readyState !== WebSocket.OPEN && this.socketAdapter._ws?.readyState !== WebSocket.CONNECTING) {
      debug("ReconnectManager.disconnected: websocket is not OPEN or CONNECTING");
      this.clearReconnectTimeout();
      let delayLeft;
      if (this.state === "connected") {
        this.intendedDelay = this.getMinDelay();
        delayLeft = this.intendedDelay;
      } else {
        delayLeft = this.lastAttemptStart !== null ? this.lastAttemptStart + this.intendedDelay - Date.now() : 0;
      }
      if (delayLeft > 0) {
        debug("ReconnectManager.disconnected: delaying, delayLeft", delayLeft);
        this.state = "delay";
        this.reconnectTimeout = setTimeout(() => this.disconnected(), delayLeft);
      } else {
        this.state = "pendingAttempt";
        this.intendedDelay = Math.min(
          this.getMaxDelay(),
          Math.max(this.getMinDelay(), this.intendedDelay) * DELAY_EXPONENT
        );
        debug(
          "ReconnectManager.disconnected: attempting a connection, next delay",
          this.intendedDelay
        );
        this.scheduleAttempt();
      }
    }
  }
  /**
   * Handles successful connection events and resets reconnection state.
   * This method is called when the WebSocket successfully connects to the server.
   *
   * It clears any pending reconnection attempts and resets the delay back to minimum
   * for future connection attempts.
   *
   * @example
   * ```ts
   * // Called automatically when WebSocket opens successfully
   * manager.connected()
   * ```
   */
  connected() {
    debug("ReconnectManager.connected");
    if (this.socketAdapter._ws?.readyState === WebSocket.OPEN) {
      debug("ReconnectManager.connected: websocket is OPEN");
      this.state = "connected";
      this.clearReconnectTimeout();
      this.intendedDelay = ACTIVE_MIN_DELAY;
    }
  }
  /**
   * Permanently closes the reconnection manager and cleans up all resources.
   * This stops all pending reconnection attempts and removes event listeners.
   * Once closed, the manager cannot be reused.
   */
  close() {
    this.disposables.forEach((d) => d());
    this.isDisposed = true;
  }
};
function httpToWs(url) {
  return url.replace(/^http(s)?:/, "ws$1:");
}

// node_modules/@tldraw/sync-core/dist-esm/lib/DurableObjectSqliteSyncWrapper.mjs
var DurableObjectStatement = class {
  constructor(sql, query) {
    this.sql = sql;
    this.query = query;
  }
  iterate(...bindings) {
    const result = this.sql.exec(this.query, ...bindings);
    return result[Symbol.iterator]();
  }
  all(...bindings) {
    return this.sql.exec(this.query, ...bindings).toArray();
  }
  run(...bindings) {
    this.sql.exec(this.query, ...bindings);
  }
};
var DurableObjectSqliteSyncWrapper = class {
  constructor(storage, config) {
    this.storage = storage;
    this.config = config;
  }
  exec(sql) {
    this.storage.sql.exec(sql);
  }
  prepare(sql) {
    return new DurableObjectStatement(this.storage.sql, sql);
  }
  transaction(callback) {
    return this.storage.transactionSync(callback);
  }
};

// node_modules/@tldraw/sync-core/dist-esm/lib/MicrotaskNotifier.mjs
var MicrotaskNotifier = class {
  listeners = /* @__PURE__ */ new Set();
  notify(...props) {
    queueMicrotask(() => {
      for (const listener of this.listeners) {
        try {
          listener(...props);
        } catch (error) {
          console.error("Error in MicrotaskNotifier listener", error);
        }
      }
    });
  }
  register(_listener) {
    let didDelete = false;
    queueMicrotask(() => {
      if (didDelete) return;
      this.listeners.add(_listener);
    });
    return () => {
      if (didDelete) return;
      didDelete = true;
      this.listeners.delete(_listener);
    };
  }
};

// node_modules/@tldraw/sync-core/dist-esm/lib/InMemorySyncStorage.mjs
var TOMBSTONE_PRUNE_BUFFER_SIZE = 1e3;
var MAX_TOMBSTONES = 5e3;
function computeTombstonePruning({
  tombstones,
  documentClock,
  maxTombstones = MAX_TOMBSTONES,
  pruneBufferSize = TOMBSTONE_PRUNE_BUFFER_SIZE
}) {
  if (tombstones.length <= maxTombstones) {
    return null;
  }
  let cutoff = pruneBufferSize + tombstones.length - maxTombstones;
  while (cutoff < tombstones.length && tombstones[cutoff - 1]?.clock === tombstones[cutoff]?.clock) {
    cutoff++;
  }
  const oldestRemaining = tombstones[cutoff];
  const newTombstoneHistoryStartsAtClock = oldestRemaining?.clock ?? documentClock;
  const idsToDelete = tombstones.slice(0, cutoff).map((t) => t.id);
  return { newTombstoneHistoryStartsAtClock, idsToDelete };
}
var DEFAULT_INITIAL_SNAPSHOT = {
  documentClock: 0,
  tombstoneHistoryStartsAtClock: 0,
  schema: createTLSchema().serialize(),
  documents: [
    {
      state: DocumentRecordType.create({ id: TLDOCUMENT_ID }),
      lastChangedClock: 0
    },
    {
      state: PageRecordType.create({
        id: "page:page",
        name: "Page 1",
        index: "a1"
      }),
      lastChangedClock: 0
    }
  ]
};
var InMemorySyncStorage = class {
  /** @internal */
  documents;
  /** @internal */
  tombstones;
  /** @internal */
  schema;
  /** @internal */
  documentClock;
  /** @internal */
  tombstoneHistoryStartsAtClock;
  notifier = new MicrotaskNotifier();
  onChange(callback) {
    return this.notifier.register(callback);
  }
  constructor({
    snapshot = DEFAULT_INITIAL_SNAPSHOT,
    onChange
  } = {}) {
    const maxClockValue = Math.max(
      0,
      ...Object.values(snapshot.tombstones ?? {}),
      ...Object.values(snapshot.documents.map((d) => d.lastChangedClock))
    );
    this.documents = new AtomMap(
      "room documents",
      snapshot.documents.map((d) => [
        d.state.id,
        { state: devFreeze(d.state), lastChangedClock: d.lastChangedClock }
      ])
    );
    const documentClock = Math.max(maxClockValue, snapshot.documentClock ?? snapshot.clock ?? 0);
    this.documentClock = atom("document clock", documentClock);
    const tombstoneHistoryStartsAtClock = Math.min(
      snapshot.tombstoneHistoryStartsAtClock ?? documentClock,
      documentClock
    );
    this.tombstoneHistoryStartsAtClock = atom(
      "tombstone history starts at clock",
      tombstoneHistoryStartsAtClock
    );
    this.schema = atom("schema", snapshot.schema ?? createTLSchema().serializeEarliestVersion());
    this.tombstones = new AtomMap(
      "room tombstones",
      // If the tombstone history starts now (or we didn't have the
      // tombstoneHistoryStartsAtClock) then there are no tombstones
      tombstoneHistoryStartsAtClock === documentClock ? [] : objectMapEntries(snapshot.tombstones ?? {})
    );
    if (onChange) {
      this.onChange(onChange);
    }
  }
  transaction(callback, opts) {
    const clockBefore = this.documentClock.get();
    const trackChanges = opts?.emitChanges === "always";
    const txn = new InMemorySyncStorageTransaction(this);
    let result;
    let changes;
    try {
      result = transaction(() => {
        return callback(txn);
      });
      if (trackChanges) {
        changes = txn.getChangesSince(clockBefore)?.diff;
      }
    } catch (error) {
      console.error("Error in transaction", error);
      throw error;
    } finally {
      txn.close();
    }
    if (typeof result === "object" && result && "then" in result && typeof result.then === "function") {
      const err = new Error("Transaction must return a value, not a promise");
      console.error(err);
      throw err;
    }
    const clockAfter = this.documentClock.get();
    const didChange = clockAfter > clockBefore;
    if (didChange) {
      this.notifier.notify({ id: opts?.id, documentClock: clockAfter });
    }
    return { documentClock: clockAfter, didChange: clockAfter > clockBefore, result, changes };
  }
  getClock() {
    return this.documentClock.get();
  }
  /** @internal */
  pruneTombstones = (0, import_lodash2.default)(
    () => {
      if (this.tombstones.size > MAX_TOMBSTONES) {
        const tombstones = Array.from(this.tombstones.entries()).map(([id, clock]) => ({ id, clock })).sort((a, b) => a.clock - b.clock);
        const result = computeTombstonePruning({
          tombstones,
          documentClock: this.documentClock.get()
        });
        if (result) {
          this.tombstoneHistoryStartsAtClock.set(result.newTombstoneHistoryStartsAtClock);
          this.tombstones.deleteMany(result.idsToDelete);
        }
      }
    },
    1e3,
    // prevent this from running synchronously to avoid blocking requests
    { leading: false }
  );
  getSnapshot() {
    return {
      tombstoneHistoryStartsAtClock: this.tombstoneHistoryStartsAtClock.get(),
      documentClock: this.documentClock.get(),
      documents: Array.from(this.documents.values()),
      tombstones: Object.fromEntries(this.tombstones.entries()),
      schema: this.schema.get()
    };
  }
};
var InMemorySyncStorageTransaction = class {
  constructor(storage) {
    this.storage = storage;
    this._clock = this.storage.documentClock.get();
  }
  _clock;
  _closed = false;
  /** @internal */
  close() {
    this._closed = true;
  }
  assertNotClosed() {
    assert(!this._closed, "Transaction has ended, iterator cannot be consumed");
  }
  getClock() {
    return this._clock;
  }
  didIncrementClock = false;
  getNextClock() {
    if (!this.didIncrementClock) {
      this.didIncrementClock = true;
      this._clock = this.storage.documentClock.set(this.storage.documentClock.get() + 1);
    }
    return this._clock;
  }
  get(id) {
    this.assertNotClosed();
    return this.storage.documents.get(id)?.state;
  }
  set(id, record) {
    this.assertNotClosed();
    assert(id === record.id, `Record id mismatch: key does not match record.id`);
    const clock = this.getNextClock();
    if (this.storage.tombstones.has(id)) {
      this.storage.tombstones.delete(id);
    }
    this.storage.documents.set(id, {
      state: devFreeze(record),
      lastChangedClock: clock
    });
  }
  delete(id) {
    this.assertNotClosed();
    if (!this.storage.documents.has(id)) return;
    const clock = this.getNextClock();
    this.storage.documents.delete(id);
    this.storage.tombstones.set(id, clock);
    this.storage.pruneTombstones();
  }
  *entries() {
    this.assertNotClosed();
    for (const [id, record] of this.storage.documents.entries()) {
      this.assertNotClosed();
      yield [id, record.state];
    }
  }
  *keys() {
    this.assertNotClosed();
    for (const key of this.storage.documents.keys()) {
      this.assertNotClosed();
      yield key;
    }
  }
  *values() {
    this.assertNotClosed();
    for (const record of this.storage.documents.values()) {
      this.assertNotClosed();
      yield record.state;
    }
  }
  getSchema() {
    this.assertNotClosed();
    return this.storage.schema.get();
  }
  setSchema(schema) {
    this.assertNotClosed();
    this.storage.schema.set(schema);
  }
  getChangesSince(sinceClock) {
    this.assertNotClosed();
    const clock = this.storage.documentClock.get();
    if (sinceClock === clock) return void 0;
    if (sinceClock > clock) {
      sinceClock = -1;
    }
    const diff = { puts: {}, deletes: [] };
    const wipeAll = sinceClock < this.storage.tombstoneHistoryStartsAtClock.get();
    for (const doc of this.storage.documents.values()) {
      if (wipeAll || doc.lastChangedClock > sinceClock) {
        diff.puts[doc.state.id] = doc.state;
      }
    }
    if (!wipeAll) {
      for (const [id, clock2] of this.storage.tombstones.entries()) {
        if (clock2 > sinceClock) {
          diff.deletes.push(id);
        }
      }
    }
    return { diff, wipeAll };
  }
};

// node_modules/@tldraw/sync-core/dist-esm/lib/NodeSqliteWrapper.mjs
var NodeSqliteWrapper = class {
  constructor(db, config) {
    this.db = db;
    this.config = config;
  }
  exec(sql) {
    this.db.exec(sql);
  }
  prepare(sql) {
    return this.db.prepare(sql);
  }
  transaction(callback) {
    this.db.exec("BEGIN");
    let result;
    try {
      result = callback();
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    this.db.exec("COMMIT");
    return result;
  }
};

// node_modules/@tldraw/sync-core/dist-esm/lib/RoomSession.mjs
var RoomSessionState = {
  /** Session is waiting for the initial connect message from the client */
  AwaitingConnectMessage: "awaiting-connect-message",
  /** Session is disconnected but waiting for final cleanup before removal */
  AwaitingRemoval: "awaiting-removal",
  /** Session is fully connected and actively synchronizing */
  Connected: "connected"
};
var SESSION_START_WAIT_TIME = 1e4;
var SESSION_REMOVAL_WAIT_TIME = 5e3;
var SESSION_IDLE_TIMEOUT = 2e4;

// node_modules/@tldraw/sync-core/dist-esm/lib/TLSyncStorage.mjs
function toNetworkDiff(diff) {
  const networkDiff = {};
  for (const [id, put] of objectMapEntriesIterable(diff.puts)) {
    if (Array.isArray(put)) {
      const patch = diffRecord(put[0], put[1]);
      if (patch) {
        networkDiff[id] = [RecordOpType.Patch, patch];
      }
    } else {
      networkDiff[id] = [RecordOpType.Put, put];
    }
  }
  for (const id of diff.deletes) {
    networkDiff[id] = [RecordOpType.Remove];
  }
  return networkDiff;
}
function loadSnapshotIntoStorage(txn, schema, snapshot) {
  snapshot = convertStoreSnapshotToRoomSnapshot(snapshot);
  assert(snapshot.schema, "Schema is required");
  const docIds = /* @__PURE__ */ new Set();
  for (const doc of snapshot.documents) {
    docIds.add(doc.state.id);
    const existing = txn.get(doc.state.id);
    if ((0, import_lodash.default)(existing, doc.state)) continue;
    txn.set(doc.state.id, doc.state);
  }
  for (const id of txn.keys()) {
    if (!docIds.has(id)) {
      txn.delete(id);
    }
  }
  txn.setSchema(snapshot.schema);
  schema.migrateStorage(txn);
}
function convertStoreSnapshotToRoomSnapshot(snapshot) {
  if ("documents" in snapshot) return snapshot;
  return {
    clock: 0,
    documentClock: 0,
    documents: objectMapValues(snapshot.store).map((state) => ({
      state,
      lastChangedClock: 0
    })),
    schema: snapshot.schema,
    tombstones: {}
  };
}

// node_modules/@tldraw/sync-core/dist-esm/lib/SQLiteSyncStorage.mjs
function migrateSqliteSyncStorage(storage, {
  documentsTable = "documents",
  tombstonesTable = "tombstones",
  metadataTable = "metadata"
} = {}) {
  let migrationVersion = 0;
  try {
    const row = storage.prepare(`SELECT migrationVersion FROM ${metadataTable} LIMIT 1`).all()[0];
    migrationVersion = row?.migrationVersion ?? 0;
  } catch (_e) {
  }
  if (migrationVersion === 0) {
    migrationVersion++;
    storage.exec(`
			CREATE TABLE ${documentsTable} (
				id TEXT PRIMARY KEY,
				state BLOB NOT NULL,
				lastChangedClock INTEGER NOT NULL
			);

			CREATE INDEX idx_${documentsTable}_lastChangedClock ON ${documentsTable}(lastChangedClock);

			CREATE TABLE ${tombstonesTable} (
				id TEXT PRIMARY KEY,
				clock INTEGER NOT NULL
			);
			CREATE INDEX idx_${tombstonesTable}_clock ON ${tombstonesTable}(clock);

			-- This table is used to store the metadata for the sync storage.
			-- There should only be one row in this table.
			CREATE TABLE ${metadataTable} (
			  migrationVersion INTEGER NOT NULL,
				documentClock INTEGER NOT NULL,
				tombstoneHistoryStartsAtClock INTEGER NOT NULL,
				schema TEXT NOT NULL
			);
			
			INSERT INTO ${metadataTable} (migrationVersion, documentClock, tombstoneHistoryStartsAtClock, schema) VALUES (2, 0, 0, '')
		`);
    migrationVersion++;
  }
  if (migrationVersion === 1) {
    migrationVersion++;
    storage.exec(`
			CREATE TABLE ${documentsTable}_new (
				id TEXT PRIMARY KEY,
				state BLOB NOT NULL,
				lastChangedClock INTEGER NOT NULL
			);
			
			INSERT INTO ${documentsTable}_new (id, state, lastChangedClock)
			SELECT id, CAST(state AS BLOB), lastChangedClock FROM ${documentsTable};
			
			DROP TABLE ${documentsTable};
			
			ALTER TABLE ${documentsTable}_new RENAME TO ${documentsTable};
			
			CREATE INDEX idx_${documentsTable}_lastChangedClock ON ${documentsTable}(lastChangedClock);
		`);
  }
  storage.exec(`UPDATE ${metadataTable} SET migrationVersion = ${migrationVersion}`);
}
var textEncoder = new TextEncoder();
var textDecoder = new TextDecoder();
function encodeState(state) {
  return textEncoder.encode(JSON.stringify(state));
}
function decodeState(state) {
  return JSON.parse(textDecoder.decode(state));
}
var SQLiteSyncStorage = class _SQLiteSyncStorage {
  /**
   * Check if the storage has been initialized (has data in the clock table).
   * Useful for determining whether to load from an external source on first access.
   */
  static hasBeenInitialized(storage) {
    const prefix = storage.config?.tablePrefix ?? "";
    try {
      const schema = storage.prepare(`SELECT schema FROM ${prefix}metadata LIMIT 1`).all()[0]?.schema;
      return !!schema;
    } catch (_e) {
      return false;
    }
  }
  /**
   * Get the current document clock value from storage without fully initializing.
   * Returns null if storage has not been initialized.
   * Useful for comparing storage freshness against external sources.
   */
  static getDocumentClock(storage) {
    const prefix = storage.config?.tablePrefix ?? "";
    try {
      const row = storage.prepare(`SELECT documentClock FROM ${prefix}metadata LIMIT 1`).all()[0];
      if (row && _SQLiteSyncStorage.hasBeenInitialized(storage)) {
        return row.documentClock;
      }
      return null;
    } catch (_e) {
      return null;
    }
  }
  // Prepared statements - created once, reused many times
  stmts;
  sql;
  constructor({
    sql,
    snapshot,
    onChange
  }) {
    this.sql = sql;
    const prefix = sql.config?.tablePrefix ?? "";
    const documentsTable = `${prefix}documents`;
    const tombstonesTable = `${prefix}tombstones`;
    const metadataTable = `${prefix}metadata`;
    migrateSqliteSyncStorage(this.sql, { documentsTable, tombstonesTable, metadataTable });
    this.stmts = {
      // Metadata
      getDocumentClock: this.sql.prepare(
        `SELECT documentClock FROM ${metadataTable} LIMIT 1`
      ),
      getTombstoneHistoryStartsAtClock: this.sql.prepare(
        `SELECT tombstoneHistoryStartsAtClock FROM ${metadataTable}`
      ),
      getSchema: this.sql.prepare(`SELECT schema FROM ${metadataTable}`),
      setSchema: this.sql.prepare(`UPDATE ${metadataTable} SET schema = ?`),
      setTombstoneHistoryStartsAtClock: this.sql.prepare(
        `UPDATE ${metadataTable} SET tombstoneHistoryStartsAtClock = ?`
      ),
      incrementDocumentClock: this.sql.prepare(
        `UPDATE ${metadataTable} SET documentClock = documentClock + 1`
      ),
      // Documents
      getDocument: this.sql.prepare(
        `SELECT state FROM ${documentsTable} WHERE id = ?`
      ),
      insertDocument: this.sql.prepare(`INSERT OR REPLACE INTO ${documentsTable} (id, state, lastChangedClock) VALUES (?, ?, ?)`),
      deleteDocument: this.sql.prepare(
        `DELETE FROM ${documentsTable} WHERE id = ?`
      ),
      documentExists: this.sql.prepare(
        `SELECT id FROM ${documentsTable} WHERE id = ?`
      ),
      iterateDocuments: this.sql.prepare(
        `SELECT state, lastChangedClock FROM ${documentsTable}`
      ),
      iterateDocumentEntries: this.sql.prepare(
        `SELECT id, state FROM ${documentsTable}`
      ),
      iterateDocumentKeys: this.sql.prepare(`SELECT id FROM ${documentsTable}`),
      iterateDocumentValues: this.sql.prepare(
        `SELECT state FROM ${documentsTable}`
      ),
      getDocumentsChangedSince: this.sql.prepare(
        `SELECT state FROM ${documentsTable} WHERE lastChangedClock > ?`
      ),
      // Tombstones
      insertTombstone: this.sql.prepare(
        `INSERT OR REPLACE INTO ${tombstonesTable} (id, clock) VALUES (?, ?)`
      ),
      deleteTombstone: this.sql.prepare(
        `DELETE FROM ${tombstonesTable} WHERE id = ?`
      ),
      deleteTombstonesBefore: this.sql.prepare(
        `DELETE FROM ${tombstonesTable} WHERE clock < ?`
      ),
      countTombstones: this.sql.prepare(
        `SELECT count(*) as count FROM ${tombstonesTable}`
      ),
      iterateTombstones: this.sql.prepare(
        `SELECT id, clock FROM ${tombstonesTable} ORDER BY clock ASC`
      ),
      getTombstonesChangedSince: this.sql.prepare(
        `SELECT id FROM ${tombstonesTable} WHERE clock > ?`
      ),
      // Initial setup (only used when loading a snapshot)
      updateMetadata: this.sql.prepare(
        `UPDATE ${metadataTable} SET documentClock = ?, tombstoneHistoryStartsAtClock = ?, schema = ?`
      )
    };
    const hasData = _SQLiteSyncStorage.hasBeenInitialized(sql);
    if (snapshot || !hasData) {
      snapshot = convertStoreSnapshotToRoomSnapshot(snapshot ?? DEFAULT_INITIAL_SNAPSHOT);
      const documentClock = snapshot.documentClock ?? snapshot.clock ?? 0;
      const tombstoneHistoryStartsAtClock = snapshot.tombstoneHistoryStartsAtClock ?? documentClock;
      this.sql.exec(`
				DELETE FROM ${documentsTable};
				DELETE FROM ${tombstonesTable};
			`);
      for (const doc of snapshot.documents) {
        this.stmts.insertDocument.run(doc.state.id, encodeState(doc.state), doc.lastChangedClock);
      }
      if (snapshot.tombstones) {
        for (const [id, clock] of objectMapEntries(snapshot.tombstones)) {
          this.stmts.insertTombstone.run(id, clock);
        }
      }
      this.stmts.updateMetadata.run(
        documentClock,
        tombstoneHistoryStartsAtClock,
        JSON.stringify(snapshot.schema)
      );
    }
    if (onChange) {
      this.onChange(onChange);
    }
  }
  notifier = new MicrotaskNotifier();
  onChange(callback) {
    return this.notifier.register(callback);
  }
  transaction(callback, opts) {
    const clockBefore = this.getClock();
    const trackChanges = opts?.emitChanges === "always";
    return this.sql.transaction(() => {
      const txn = new SQLiteSyncStorageTransaction(this, this.stmts);
      let result;
      let changes;
      try {
        result = transaction(() => {
          return callback(txn);
        });
        if (trackChanges) {
          changes = txn.getChangesSince(clockBefore)?.diff;
        }
      } finally {
        txn.close();
      }
      if (typeof result === "object" && result && "then" in result && typeof result.then === "function") {
        throw new Error("Transaction must return a value, not a promise");
      }
      const clockAfter = this.getClock();
      const didChange = clockAfter > clockBefore;
      if (didChange) {
        this.notifier.notify({ id: opts?.id, documentClock: clockAfter });
      }
      return { documentClock: clockAfter, didChange: clockAfter > clockBefore, result, changes };
    });
  }
  getClock() {
    const clockRow = this.stmts.getDocumentClock.all()[0];
    return clockRow?.documentClock ?? 0;
  }
  /** @internal */
  _getTombstoneHistoryStartsAtClock() {
    const clockRow = this.stmts.getTombstoneHistoryStartsAtClock.all()[0];
    return clockRow?.tombstoneHistoryStartsAtClock ?? 0;
  }
  /** @internal */
  _getSchema() {
    const clockRow = this.stmts.getSchema.all()[0];
    assert(clockRow, "Storage not initialized - clock row missing");
    return JSON.parse(clockRow.schema);
  }
  /** @internal */
  _setSchema(schema) {
    this.stmts.setSchema.run(JSON.stringify(schema));
  }
  /** @internal */
  pruneTombstones = (0, import_lodash2.default)(
    () => {
      const tombstoneCount = this.stmts.countTombstones.all()[0].count;
      if (tombstoneCount > MAX_TOMBSTONES) {
        const tombstones = this.stmts.iterateTombstones.all();
        const result = computeTombstonePruning({ tombstones, documentClock: this.getClock() });
        if (result) {
          this.stmts.setTombstoneHistoryStartsAtClock.run(result.newTombstoneHistoryStartsAtClock);
          this.stmts.deleteTombstonesBefore.run(result.newTombstoneHistoryStartsAtClock);
        }
      }
    },
    1e3,
    // prevent this from running synchronously to avoid blocking requests
    { leading: false }
  );
  getSnapshot() {
    return {
      tombstoneHistoryStartsAtClock: this._getTombstoneHistoryStartsAtClock(),
      documentClock: this.getClock(),
      documents: Array.from(this._iterateDocuments()),
      tombstones: Object.fromEntries(this._iterateTombstones()),
      schema: this._getSchema()
    };
  }
  *_iterateDocuments() {
    for (const row of this.stmts.iterateDocuments.iterate()) {
      yield { state: decodeState(row.state), lastChangedClock: row.lastChangedClock };
    }
  }
  *_iterateTombstones() {
    for (const row of this.stmts.iterateTombstones.iterate()) {
      yield [row.id, row.clock];
    }
  }
};
var SQLiteSyncStorageTransaction = class {
  constructor(storage, stmts) {
    this.storage = storage;
    this.stmts = stmts;
    this._clock = this.storage.getClock();
  }
  _clock;
  _closed = false;
  _didIncrementClock = false;
  /** @internal */
  close() {
    this._closed = true;
  }
  assertNotClosed() {
    assert(!this._closed, "Transaction has ended, iterator cannot be consumed");
  }
  getClock() {
    return this._clock;
  }
  getNextClock() {
    if (!this._didIncrementClock) {
      this._didIncrementClock = true;
      this.stmts.incrementDocumentClock.run();
      this._clock = this.storage.getClock();
    }
    return this._clock;
  }
  get(id) {
    this.assertNotClosed();
    const row = this.stmts.getDocument.all(id)[0];
    if (!row) return void 0;
    return decodeState(row.state);
  }
  set(id, record) {
    this.assertNotClosed();
    assert(id === record.id, `Record id mismatch: key does not match record.id`);
    const clock = this.getNextClock();
    this.stmts.deleteTombstone.run(id);
    this.stmts.insertDocument.run(id, encodeState(record), clock);
  }
  delete(id) {
    this.assertNotClosed();
    const exists = this.stmts.documentExists.all(id)[0];
    if (!exists) return;
    const clock = this.getNextClock();
    this.stmts.deleteDocument.run(id);
    this.stmts.insertTombstone.run(id, clock);
    this.storage.pruneTombstones();
  }
  *entries() {
    this.assertNotClosed();
    for (const row of this.stmts.iterateDocumentEntries.iterate()) {
      this.assertNotClosed();
      yield [row.id, decodeState(row.state)];
    }
  }
  *keys() {
    this.assertNotClosed();
    for (const row of this.stmts.iterateDocumentKeys.iterate()) {
      this.assertNotClosed();
      yield row.id;
    }
  }
  *values() {
    this.assertNotClosed();
    for (const row of this.stmts.iterateDocumentValues.iterate()) {
      this.assertNotClosed();
      yield decodeState(row.state);
    }
  }
  getSchema() {
    this.assertNotClosed();
    return this.storage._getSchema();
  }
  setSchema(schema) {
    this.assertNotClosed();
    this.storage._setSchema(schema);
  }
  getChangesSince(sinceClock) {
    this.assertNotClosed();
    const clock = this.storage.getClock();
    if (sinceClock === clock) return void 0;
    if (sinceClock > clock) {
      sinceClock = -1;
    }
    const diff = { puts: {}, deletes: [] };
    const wipeAll = sinceClock < this.storage._getTombstoneHistoryStartsAtClock();
    if (wipeAll) {
      for (const row of this.stmts.iterateDocumentValues.iterate()) {
        const state = decodeState(row.state);
        diff.puts[state.id] = state;
      }
    } else {
      for (const row of this.stmts.getDocumentsChangedSince.iterate(sinceClock)) {
        const state = decodeState(row.state);
        diff.puts[state.id] = state;
      }
      for (const row of this.stmts.getTombstonesChangedSince.iterate(sinceClock)) {
        diff.deletes.push(row.id);
      }
    }
    return { diff, wipeAll };
  }
};

// node_modules/@tldraw/sync-core/dist-esm/lib/TLRemoteSyncError.mjs
var TLRemoteSyncError = class extends Error {
  /**
   * Creates a new TLRemoteSyncError with the specified reason.
   *
   * reason - The specific reason code or custom string describing why the sync failed.
   *                 When using predefined reasons from TLSyncErrorCloseEventReason, the client
   *                 can handle specific error types appropriately. Custom strings allow for
   *                 application-specific error details.
   */
  constructor(reason) {
    super(`sync error: ${reason}`);
    this.reason = reason;
  }
  name = "RemoteSyncError";
};

// node_modules/@tldraw/sync-core/dist-esm/lib/ServerSocketAdapter.mjs
var ServerSocketAdapter = class {
  /**
   * Creates a new ServerSocketAdapter instance.
   *
   * opts - Configuration options for the adapter
   */
  constructor(opts) {
    this.opts = opts;
  }
  /**
   * Checks if the underlying WebSocket connection is currently open and ready to send messages.
   *
   * @returns True if the connection is open (readyState === 1), false otherwise
   */
  // eslint-disable-next-line no-restricted-syntax
  get isOpen() {
    return this.opts.ws.readyState === 1;
  }
  /**
   * Sends a sync protocol message to the connected client. The message is JSON stringified
   * before being sent through the WebSocket. If configured, the onBeforeSendMessage callback
   * is invoked before sending.
   *
   * @param msg - The sync protocol message to send
   */
  // see TLRoomSocket for details on why this accepts a union and not just arrays
  sendMessage(msg) {
    const message = JSON.stringify(msg);
    this.opts.onBeforeSendMessage?.(msg, message);
    this.opts.ws.send(message);
  }
  /**
   * Closes the WebSocket connection with an optional close code and reason.
   *
   * @param code - Optional close code (default: 1000 for normal closure)
   * @param reason - Optional human-readable reason for closing
   */
  close(code, reason) {
    this.opts.ws.close(code, reason);
  }
};

// node_modules/nanoevents/index.js
var createNanoEvents = () => ({
  events: {},
  emit(event, ...args) {
    let callbacks = this.events[event] || [];
    for (let i = 0, length = callbacks.length; i < length; i++) {
      callbacks[i](...args);
    }
  },
  on(event, cb) {
    this.events[event]?.push(cb) || (this.events[event] = [cb]);
    return () => {
      this.events[event] = this.events[event]?.filter((i) => cb !== i);
    };
  }
});

// node_modules/@tldraw/sync-core/dist-esm/lib/recordDiff.mjs
function diffAndValidateRecord(prevState, newState, recordType, legacyAppendMode = false) {
  const diff = diffRecord(prevState, newState, legacyAppendMode);
  if (!diff) return;
  try {
    recordType.validate(newState);
  } catch (error) {
    throw new TLSyncError(error.message, TLSyncErrorCloseEventReason.INVALID_RECORD);
  }
  return diff;
}
function applyAndDiffRecord(prevState, diff, recordType, legacyAppendMode = false) {
  const newState = applyObjectDiff(prevState, diff);
  if (newState === prevState) return;
  const actualDiff = diffAndValidateRecord(prevState, newState, recordType, legacyAppendMode);
  if (!actualDiff) return;
  return [actualDiff, newState];
}
function validateRecord(state, recordType) {
  try {
    recordType.validate(state);
  } catch (error) {
    throw new TLSyncError(error.message, TLSyncErrorCloseEventReason.INVALID_RECORD);
  }
}

// node_modules/@tldraw/sync-core/dist-esm/lib/TLSyncRoom.mjs
var DATA_MESSAGE_DEBOUNCE_INTERVAL = 1e3 / 60;
var timeSince = (time) => Date.now() - time;
var TLSyncRoom = class {
  // A table of connected clients
  sessions = /* @__PURE__ */ new Map();
  lastDocumentClock = 0;
  // eslint-disable-next-line local/prefer-class-methods
  pruneSessions = () => {
    for (const client of this.sessions.values()) {
      switch (client.state) {
        case RoomSessionState.Connected: {
          const hasTimedOut = timeSince(client.lastInteractionTime) > SESSION_IDLE_TIMEOUT;
          if (hasTimedOut || !client.socket.isOpen) {
            this.cancelSession(client.sessionId);
          }
          break;
        }
        case RoomSessionState.AwaitingConnectMessage: {
          const hasTimedOut = timeSince(client.sessionStartTime) > SESSION_START_WAIT_TIME;
          if (hasTimedOut || !client.socket.isOpen) {
            this.removeSession(client.sessionId);
          }
          break;
        }
        case RoomSessionState.AwaitingRemoval: {
          const hasTimedOut = timeSince(client.cancellationTime) > SESSION_REMOVAL_WAIT_TIME;
          if (hasTimedOut) {
            this.removeSession(client.sessionId);
          }
          break;
        }
        default: {
          exhaustiveSwitchError(client);
        }
      }
    }
  };
  presenceStore = new PresenceStore();
  disposables = [interval(this.pruneSessions, 2e3)];
  _isClosed = false;
  /**
   * Close the room and clean up all resources. Disconnects all sessions
   * and stops background processes.
   */
  close() {
    this.disposables.forEach((d) => d());
    this.sessions.forEach((session) => {
      session.socket.close();
    });
    this._isClosed = true;
  }
  /**
   * Check if the room has been closed and is no longer accepting connections.
   *
   * @returns True if the room is closed
   */
  isClosed() {
    return this._isClosed;
  }
  events = createNanoEvents();
  // Storage layer for documents, tombstones, and clocks
  storage;
  serializedSchema;
  documentTypes;
  presenceType;
  log;
  schema;
  constructor(opts) {
    this.schema = opts.schema;
    this.log = opts.log;
    this.onPresenceChange = opts.onPresenceChange;
    this.storage = opts.storage;
    assert(
      isNativeStructuredClone,
      "TLSyncRoom is supposed to run either on Cloudflare Workersor on a 18+ version of Node.js, which both support the native structuredClone API"
    );
    this.serializedSchema = JSON.parse(JSON.stringify(this.schema.serialize()));
    this.documentTypes = new Set(
      Object.values(this.schema.types).filter((t) => t.scope === "document").map((t) => t.typeName)
    );
    const presenceTypes = new Set(
      Object.values(this.schema.types).filter((t) => t.scope === "presence")
    );
    if (presenceTypes.size > 1) {
      throw new Error(
        `TLSyncRoom: exactly zero or one presence type is expected, but found ${presenceTypes.size}`
      );
    }
    this.presenceType = presenceTypes.values().next()?.value ?? null;
    const { documentClock } = this.storage.transaction((txn) => {
      this.schema.migrateStorage(txn);
    });
    this.lastDocumentClock = documentClock;
    this.disposables.push(
      this.storage.onChange(({ id }) => {
        if (id !== this.internalTxnId) {
          this.broadcastExternalStorageChanges();
        }
      })
    );
  }
  broadcastExternalStorageChanges() {
    this.storage.transaction((txn) => {
      this.broadcastChanges(txn);
      this.lastDocumentClock = txn.getClock();
    });
  }
  /**
   * Send a message to a particular client. Debounces data events
   *
   * @param sessionId - The id of the session to send the message to.
   * @param message - The message to send. UNSAFE Any diffs must have been downgraded already if necessary
   */
  _unsafe_sendMessage(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.log?.warn?.("Tried to send message to unknown session", message.type);
      return;
    }
    if (session.state !== RoomSessionState.Connected) {
      this.log?.warn?.("Tried to send message to disconnected client", message.type);
      return;
    }
    if (session.socket.isOpen) {
      if (message.type !== "patch" && message.type !== "push_result") {
        if (message.type !== "pong") {
          this._flushDataMessages(sessionId);
        }
        session.socket.sendMessage(message);
      } else {
        if (session.debounceTimer === null) {
          session.socket.sendMessage({ type: "data", data: [message] });
          session.debounceTimer = setTimeout(
            () => this._flushDataMessages(sessionId),
            DATA_MESSAGE_DEBOUNCE_INTERVAL
          );
        } else {
          session.outstandingDataMessages.push(message);
        }
      }
    } else {
      this.cancelSession(session.sessionId);
    }
  }
  // needs to accept sessionId and not a session because the session might be dead by the time
  // the timer fires
  _flushDataMessages(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.state !== RoomSessionState.Connected) {
      return;
    }
    session.debounceTimer = null;
    if (session.outstandingDataMessages.length > 0) {
      session.socket.sendMessage({ type: "data", data: session.outstandingDataMessages });
      session.outstandingDataMessages.length = 0;
    }
  }
  /** @internal */
  removeSession(sessionId, fatalReason) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.log?.warn?.("Tried to remove unknown session");
      return;
    }
    this.sessions.delete(sessionId);
    try {
      if (fatalReason) {
        session.socket.close(TLSyncErrorCloseEventCode, fatalReason);
      } else {
        session.socket.close();
      }
    } catch {
    }
    const presence = this.presenceStore.get(session.presenceId ?? "");
    if (presence) {
      this.presenceStore.delete(session.presenceId);
      this.broadcastPatch({
        puts: {},
        deletes: [session.presenceId]
      });
    }
    this.events.emit("session_removed", { sessionId, meta: session.meta });
    if (this.sessions.size === 0) {
      this.events.emit("room_became_empty");
    }
  }
  cancelSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }
    if (session.state === RoomSessionState.AwaitingRemoval) {
      this.log?.warn?.("Tried to cancel session that is already awaiting removal");
      return;
    }
    this.sessions.set(sessionId, {
      state: RoomSessionState.AwaitingRemoval,
      sessionId,
      presenceId: session.presenceId,
      socket: session.socket,
      cancellationTime: Date.now(),
      meta: session.meta,
      isReadonly: session.isReadonly,
      requiresLegacyRejection: session.requiresLegacyRejection,
      supportsStringAppend: session.supportsStringAppend
    });
    try {
      session.socket.close();
    } catch {
    }
  }
  internalTxnId = "TLSyncRoom.txn";
  /**
   * Broadcast a patch to all connected clients except the one with the sessionId provided.
   *
   * @param diff - The TLSyncForwardDiff with full records (used for migration)
   * @param networkDiff - Optional pre-computed NetworkDiff for sessions not needing migration.
   *                      If not provided, will be computed from recordsDiff.
   * @param sourceSessionId - Optional session ID to exclude from the broadcast
   */
  broadcastPatch(diff, networkDiff, sourceSessionId) {
    const unmigrated = networkDiff ?? toNetworkDiff(diff);
    if (!unmigrated) return this;
    this.sessions.forEach((session) => {
      if (session.state !== RoomSessionState.Connected) return;
      if (sourceSessionId === session.sessionId) return;
      if (!session.socket.isOpen) {
        this.cancelSession(session.sessionId);
        return;
      }
      const diffResult = this.migrateDiffOrRejectSession(
        session.sessionId,
        session.serializedSchema,
        session.requiresDownMigrations,
        diff
      );
      if (!diffResult.ok) return;
      this._unsafe_sendMessage(session.sessionId, {
        type: "patch",
        diff: diffResult.value,
        serverClock: this.lastDocumentClock
      });
    });
    return this;
  }
  /**
   * Send a custom message to a connected client. Useful for application-specific
   * communication that doesn't involve document synchronization.
   *
   * @param sessionId - The ID of the session to send the message to
   * @param data - The custom payload to send (will be JSON serialized)
   * @example
   * ```ts
   * // Send a custom notification
   * room.sendCustomMessage('user-123', {
   *   type: 'notification',
   *   message: 'Document saved successfully'
   * })
   *
   * // Send user-specific data
   * room.sendCustomMessage('user-456', {
   *   type: 'user_permissions',
   *   canEdit: true,
   *   canDelete: false
   * })
   * ```
   */
  sendCustomMessage(sessionId, data) {
    this._unsafe_sendMessage(sessionId, { type: "custom", data });
  }
  /**
   * Register a new client session with the room. The session will be in an awaiting
   * state until it sends a connect message with protocol handshake.
   *
   * @param opts - Session configuration
   *   - sessionId - Unique identifier for this session
   *   - socket - WebSocket adapter for communication
   *   - meta - Application-specific metadata for this session
   *   - isReadonly - Whether this session can modify documents
   * @returns This room instance for method chaining
   * @example
   * ```ts
   * room.handleNewSession({
   *   sessionId: crypto.randomUUID(),
   *   socket: new WebSocketAdapter(ws),
   *   meta: { userId: '123', name: 'Alice', avatar: 'url' },
   *   isReadonly: !hasEditPermission
   * })
   * ```
   *
   * @internal
   */
  handleNewSession(opts) {
    const { sessionId, socket, meta, isReadonly } = opts;
    const existing = this.sessions.get(sessionId);
    this.sessions.set(sessionId, {
      state: RoomSessionState.AwaitingConnectMessage,
      sessionId,
      socket,
      presenceId: existing?.presenceId ?? this.presenceType?.createId() ?? null,
      sessionStartTime: Date.now(),
      meta,
      isReadonly: isReadonly ?? false,
      // this gets set later during handleConnectMessage
      requiresLegacyRejection: false,
      supportsStringAppend: true
    });
    return this;
  }
  /**
   * Checks if all connected sessions support string append operations (protocol version 8+).
   * If any client is on an older version, returns false to enable legacy append mode.
   *
   * @returns True if all connected sessions are on protocol version 8 or higher
   */
  getCanEmitStringAppend() {
    for (const session of this.sessions.values()) {
      if (session.state === RoomSessionState.Connected) {
        if (!session.supportsStringAppend) {
          return false;
        }
      }
    }
    return true;
  }
  /**
   * When we send a diff to a client, if that client is on a lower version than us, we need to make
   * the diff compatible with their version. This method takes a TLSyncForwardDiff (which has full
   * records) and migrates all records down to the client's schema version, returning a NetworkDiff.
   *
   * For updates (entries with [before, after] tuples), both records are migrated and a patch is
   * computed from the migrated versions, preserving efficient patch semantics even across versions.
   *
   * If a migration fails, the session will be rejected.
   *
   * @param sessionId - The session ID (for rejection on migration failure)
   * @param serializedSchema - The client's schema to migrate to
   * @param requiresDownMigrations - Whether the client needs down migrations
   * @param diff - The TLSyncForwardDiff containing full records to migrate
   * @param unmigrated - Optional pre-computed NetworkDiff for when no migration is needed
   * @returns A NetworkDiff with migrated records, or a migration failure
   */
  migrateDiffOrRejectSession(sessionId, serializedSchema, requiresDownMigrations, diff, unmigrated) {
    if (!requiresDownMigrations) {
      return Result.ok(unmigrated ?? toNetworkDiff(diff) ?? {});
    }
    const result = {};
    for (const [id, put] of objectMapEntriesIterable(diff.puts)) {
      if (Array.isArray(put)) {
        const [from, to] = put;
        const fromResult = this.schema.migratePersistedRecord(from, serializedSchema, "down");
        if (fromResult.type === "error") {
          this.rejectSession(sessionId, TLSyncErrorCloseEventReason.CLIENT_TOO_OLD);
          return Result.err(fromResult.reason);
        }
        const toResult = this.schema.migratePersistedRecord(to, serializedSchema, "down");
        if (toResult.type === "error") {
          this.rejectSession(sessionId, TLSyncErrorCloseEventReason.CLIENT_TOO_OLD);
          return Result.err(toResult.reason);
        }
        const patch = diffRecord(fromResult.value, toResult.value);
        if (patch) {
          result[id] = [RecordOpType.Patch, patch];
        }
      } else {
        const migrationResult = this.schema.migratePersistedRecord(put, serializedSchema, "down");
        if (migrationResult.type === "error") {
          this.rejectSession(sessionId, TLSyncErrorCloseEventReason.CLIENT_TOO_OLD);
          return Result.err(migrationResult.reason);
        }
        result[id] = [RecordOpType.Put, migrationResult.value];
      }
    }
    for (const id of diff.deletes) {
      result[id] = [RecordOpType.Remove];
    }
    return Result.ok(result);
  }
  /**
   * Process an incoming message from a client session. Handles connection requests,
   * data synchronization pushes, and ping/pong for connection health.
   *
   * @param sessionId - The ID of the session that sent the message
   * @param message - The client message to process
   * @example
   * ```ts
   * // Typically called by WebSocket message handlers
   * websocket.onMessage((data) => {
   *   const message = JSON.parse(data)
   *   room.handleMessage(sessionId, message)
   * })
   * ```
   */
  async handleMessage(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      this.log?.warn?.("Received message from unknown session");
      return;
    }
    try {
      switch (message.type) {
        case "connect": {
          return this.handleConnectRequest(session, message);
        }
        case "push": {
          return this.handlePushRequest(session, message);
        }
        case "ping": {
          if (session.state === RoomSessionState.Connected) {
            session.lastInteractionTime = Date.now();
          }
          return this._unsafe_sendMessage(session.sessionId, { type: "pong" });
        }
        default: {
          exhaustiveSwitchError(message);
        }
      }
    } catch (e) {
      if (e instanceof TLSyncError) {
        this.rejectSession(session.sessionId, e.reason);
      } else {
        throw e;
      }
    }
  }
  /**
   * Reject and disconnect a session due to incompatibility or other fatal errors.
   * Sends appropriate error messages before closing the connection.
   *
   * @param sessionId - The session to reject
   * @param fatalReason - The reason for rejection (optional)
   * @example
   * ```ts
   * // Reject due to version mismatch
   * room.rejectSession('user-123', TLSyncErrorCloseEventReason.CLIENT_TOO_OLD)
   *
   * // Reject due to permission issue
   * room.rejectSession('user-456', 'Insufficient permissions')
   * ```
   */
  rejectSession(sessionId, fatalReason) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    if (!fatalReason) {
      this.removeSession(sessionId);
      return;
    }
    if (session.requiresLegacyRejection) {
      try {
        if (session.socket.isOpen) {
          let legacyReason;
          switch (fatalReason) {
            case TLSyncErrorCloseEventReason.CLIENT_TOO_OLD:
              legacyReason = TLIncompatibilityReason.ClientTooOld;
              break;
            case TLSyncErrorCloseEventReason.SERVER_TOO_OLD:
              legacyReason = TLIncompatibilityReason.ServerTooOld;
              break;
            case TLSyncErrorCloseEventReason.INVALID_RECORD:
              legacyReason = TLIncompatibilityReason.InvalidRecord;
              break;
            default:
              legacyReason = TLIncompatibilityReason.InvalidOperation;
              break;
          }
          session.socket.sendMessage({
            type: "incompatibility_error",
            reason: legacyReason
          });
        }
      } catch {
      } finally {
        this.removeSession(sessionId);
      }
    } else {
      this.removeSession(sessionId, fatalReason);
    }
  }
  forceAllReconnect() {
    for (const session of this.sessions.values()) {
      this.removeSession(session.sessionId);
    }
  }
  broadcastChanges(txn) {
    const changes = txn.getChangesSince(this.lastDocumentClock);
    if (!changes) return;
    const { wipeAll, diff } = changes;
    this.lastDocumentClock = txn.getClock();
    if (wipeAll) {
      this.forceAllReconnect();
      return;
    }
    this.broadcastPatch(diff);
  }
  handleConnectRequest(session, message) {
    let theirProtocolVersion = message.protocolVersion;
    if (theirProtocolVersion === 5) {
      theirProtocolVersion = 6;
    }
    session.requiresLegacyRejection = theirProtocolVersion === 6;
    if (theirProtocolVersion === 6) {
      theirProtocolVersion++;
    }
    if (theirProtocolVersion === 7) {
      theirProtocolVersion++;
      session.supportsStringAppend = false;
    }
    if (theirProtocolVersion == null || theirProtocolVersion < getTlsyncProtocolVersion()) {
      this.rejectSession(session.sessionId, TLSyncErrorCloseEventReason.CLIENT_TOO_OLD);
      return;
    } else if (theirProtocolVersion > getTlsyncProtocolVersion()) {
      this.rejectSession(session.sessionId, TLSyncErrorCloseEventReason.SERVER_TOO_OLD);
      return;
    }
    if (message.schema == null) {
      this.rejectSession(session.sessionId, TLSyncErrorCloseEventReason.CLIENT_TOO_OLD);
      return;
    }
    const migrations = this.schema.getMigrationsSince(message.schema);
    if (!migrations.ok || migrations.value.some((m) => m.scope !== "record" || !m.down)) {
      this.rejectSession(session.sessionId, TLSyncErrorCloseEventReason.CLIENT_TOO_OLD);
      return;
    }
    const sessionSchema = (0, import_lodash.default)(message.schema, this.serializedSchema) ? this.serializedSchema : message.schema;
    const requiresDownMigrations = migrations.value.length > 0;
    const connect = async (msg) => {
      this.sessions.set(session.sessionId, {
        state: RoomSessionState.Connected,
        sessionId: session.sessionId,
        presenceId: session.presenceId,
        socket: session.socket,
        serializedSchema: sessionSchema,
        requiresDownMigrations,
        lastInteractionTime: Date.now(),
        debounceTimer: null,
        outstandingDataMessages: [],
        supportsStringAppend: session.supportsStringAppend,
        meta: session.meta,
        isReadonly: session.isReadonly,
        requiresLegacyRejection: session.requiresLegacyRejection
      });
      this._unsafe_sendMessage(session.sessionId, msg);
    };
    const { documentClock, result } = this.storage.transaction((txn) => {
      this.broadcastChanges(txn);
      const docChanges = txn.getChangesSince(message.lastServerClock);
      const presenceDiff = this.migrateDiffOrRejectSession(
        session.sessionId,
        sessionSchema,
        requiresDownMigrations,
        {
          puts: Object.fromEntries([...this.presenceStore.values()].map((p) => [p.id, p])),
          deletes: []
        }
      );
      if (!presenceDiff.ok) return null;
      let docDiff = null;
      if (docChanges && sessionSchema !== this.serializedSchema) {
        const migrated = this.migrateDiffOrRejectSession(
          session.sessionId,
          sessionSchema,
          requiresDownMigrations,
          docChanges.diff
        );
        if (!migrated.ok) return null;
        docDiff = migrated.value;
      } else if (docChanges) {
        docDiff = toNetworkDiff(docChanges.diff);
      }
      return {
        type: "connect",
        connectRequestId: message.connectRequestId,
        hydrationType: docChanges?.wipeAll ? "wipe_all" : "wipe_presence",
        protocolVersion: getTlsyncProtocolVersion(),
        schema: this.schema.serialize(),
        serverClock: txn.getClock(),
        diff: { ...presenceDiff.value, ...docDiff },
        isReadonly: session.isReadonly
      };
    });
    this.lastDocumentClock = documentClock;
    if (result) {
      connect(result);
    }
  }
  handlePushRequest(session, message) {
    if (session && session.state !== RoomSessionState.Connected) {
      return;
    }
    if (session) {
      session.lastInteractionTime = Date.now();
    }
    const legacyAppendMode = !this.getCanEmitStringAppend();
    const propagateOp = (changes2, id, op, before, after) => {
      if (!changes2.diffs) changes2.diffs = { networkDiff: {}, diff: { puts: {}, deletes: [] } };
      changes2.diffs.networkDiff[id] = op;
      switch (op[0]) {
        case RecordOpType.Put:
          changes2.diffs.diff.puts[id] = op[1];
          break;
        case RecordOpType.Patch:
          assert(before && after, "before and after are required for patches");
          changes2.diffs.diff.puts[id] = [before, after];
          break;
        case RecordOpType.Remove:
          changes2.diffs.diff.deletes.push(id);
          break;
        default:
          exhaustiveSwitchError(op[0]);
      }
    };
    const addDocument = (storage, changes2, id, _state) => {
      const res = session ? this.schema.migratePersistedRecord(_state, session.serializedSchema, "up") : { type: "success", value: _state };
      if (res.type === "error") {
        throw new TLSyncError(res.reason, TLSyncErrorCloseEventReason.CLIENT_TOO_OLD);
      }
      const { value: state } = res;
      const doc = storage.get(id);
      if (doc) {
        const recordType = assertExists(getOwnProperty(this.schema.types, doc.typeName));
        const diff = diffAndValidateRecord(doc, state, recordType);
        if (diff) {
          storage.set(id, state);
          propagateOp(changes2, id, [RecordOpType.Patch, diff], doc, state);
        }
      } else {
        const recordType = assertExists(getOwnProperty(this.schema.types, state.typeName));
        validateRecord(state, recordType);
        storage.set(id, state);
        propagateOp(changes2, id, [RecordOpType.Put, state], void 0, void 0);
      }
      return Result.ok(void 0);
    };
    const patchDocument = (storage, changes2, id, patch) => {
      const doc = storage.get(id);
      if (!doc) return;
      const recordType = assertExists(getOwnProperty(this.schema.types, doc.typeName));
      const downgraded = session ? this.schema.migratePersistedRecord(doc, session.serializedSchema, "down") : { type: "success", value: doc };
      if (downgraded.type === "error") {
        throw new TLSyncError(downgraded.reason, TLSyncErrorCloseEventReason.CLIENT_TOO_OLD);
      }
      if (downgraded.value === doc) {
        const diff = applyAndDiffRecord(doc, patch, recordType, legacyAppendMode);
        if (diff) {
          storage.set(id, diff[1]);
          propagateOp(changes2, id, [RecordOpType.Patch, diff[0]], doc, diff[1]);
        }
      } else {
        const patched = applyObjectDiff(downgraded.value, patch);
        const upgraded = session ? this.schema.migratePersistedRecord(patched, session.serializedSchema, "up") : { type: "success", value: patched };
        if (upgraded.type === "error") {
          throw new TLSyncError(upgraded.reason, TLSyncErrorCloseEventReason.CLIENT_TOO_OLD);
        }
        const diff = diffAndValidateRecord(doc, upgraded.value, recordType, legacyAppendMode);
        if (diff) {
          storage.set(id, upgraded.value);
          propagateOp(changes2, id, [RecordOpType.Patch, diff], doc, upgraded.value);
        }
      }
    };
    const { result, documentClock, changes } = this.storage.transaction(
      (txn) => {
        this.broadcastChanges(txn);
        const docChanges = { diffs: null };
        const presenceChanges = { diffs: null };
        if (this.presenceType && session?.presenceId && "presence" in message && message.presence) {
          if (!session) throw new Error("session is required for presence pushes");
          const id = session.presenceId;
          const [type, val] = message.presence;
          const { typeName } = this.presenceType;
          switch (type) {
            case RecordOpType.Put: {
              addDocument(this.presenceStore, presenceChanges, id, {
                ...val,
                id,
                typeName
              });
              break;
            }
            case RecordOpType.Patch: {
              patchDocument(this.presenceStore, presenceChanges, id, {
                ...val,
                id: [ValueOpType.Put, id],
                typeName: [ValueOpType.Put, typeName]
              });
              break;
            }
          }
        }
        if (message.diff && !session?.isReadonly) {
          for (const [id, op] of objectMapEntriesIterable(message.diff)) {
            switch (op[0]) {
              case RecordOpType.Put: {
                if (!this.documentTypes.has(op[1].typeName)) {
                  throw new TLSyncError(
                    "invalid record",
                    TLSyncErrorCloseEventReason.INVALID_RECORD
                  );
                }
                addDocument(txn, docChanges, id, op[1]);
                break;
              }
              case RecordOpType.Patch: {
                patchDocument(txn, docChanges, id, op[1]);
                break;
              }
              case RecordOpType.Remove: {
                const doc = txn.get(id);
                if (!doc) {
                  continue;
                }
                txn.delete(id);
                propagateOp(docChanges, id, op, doc, void 0);
                break;
              }
            }
          }
        }
        return { docChanges, presenceChanges };
      },
      { id: this.internalTxnId, emitChanges: "when-different" }
    );
    this.lastDocumentClock = documentClock;
    let pushResult;
    if (changes && session) {
      result.docChanges.diffs = { networkDiff: toNetworkDiff(changes) ?? {}, diff: changes };
    }
    if ((0, import_lodash.default)(result.docChanges.diffs?.networkDiff, message.diff)) {
      pushResult = {
        type: "push_result",
        clientClock: message.clientClock,
        serverClock: documentClock,
        action: "commit"
      };
    } else if (!result.docChanges.diffs?.networkDiff) {
      pushResult = {
        type: "push_result",
        clientClock: message.clientClock,
        serverClock: documentClock,
        action: "discard"
      };
    } else if (session) {
      const diff = this.migrateDiffOrRejectSession(
        session.sessionId,
        session.serializedSchema,
        session.requiresDownMigrations,
        result.docChanges.diffs.diff,
        result.docChanges.diffs.networkDiff
      );
      if (diff.ok) {
        pushResult = {
          type: "push_result",
          clientClock: message.clientClock,
          serverClock: documentClock,
          action: { rebaseWithDiff: diff.value }
        };
      }
    }
    if (session && pushResult) {
      this._unsafe_sendMessage(session.sessionId, pushResult);
    }
    if (result.docChanges.diffs || result.presenceChanges.diffs) {
      this.broadcastPatch(
        {
          puts: {
            ...result.docChanges.diffs?.diff.puts,
            ...result.presenceChanges.diffs?.diff.puts
          },
          deletes: [
            ...result.docChanges.diffs?.diff.deletes ?? [],
            ...result.presenceChanges.diffs?.diff.deletes ?? []
          ]
        },
        {
          ...result.docChanges.diffs?.networkDiff,
          ...result.presenceChanges.diffs?.networkDiff
        },
        session?.sessionId
      );
    }
    if (result.presenceChanges.diffs) {
      queueMicrotask(() => {
        this.onPresenceChange?.();
      });
    }
  }
  /**
   * Handle the event when a client disconnects. Cleans up the session and
   * removes any presence information.
   *
   * @param sessionId - The session that disconnected
   * @example
   * ```ts
   * websocket.onClose(() => {
   *   room.handleClose(sessionId)
   * })
   * ```
   */
  handleClose(sessionId) {
    this.cancelSession(sessionId);
  }
};
var PresenceStore = class {
  presences = new AtomMap("presences");
  get(id) {
    return this.presences.get(id);
  }
  set(id, state) {
    this.presences.set(id, state);
  }
  delete(id) {
    this.presences.delete(id);
  }
  values() {
    return this.presences.values();
  }
};

// node_modules/@tldraw/sync-core/dist-esm/lib/TLSocketRoom.mjs
var TLSocketRoom = class {
  /**
   * Creates a new TLSocketRoom instance for managing collaborative document synchronization.
   *
   * opts - Configuration options for the room
   *   - initialSnapshot - Optional initial document state to load
   *   - schema - Store schema defining record types and validation
   *   - clientTimeout - Milliseconds to wait before disconnecting inactive clients
   *   - log - Optional logger for warnings and errors
   *   - onSessionRemoved - Called when a client session is removed
   *   - onBeforeSendMessage - Called before sending messages to clients
   *   - onAfterReceiveMessage - Called after receiving messages from clients
   *   - onDataChange - Called when document data changes
   *   - onPresenceChange - Called when presence data changes
   */
  constructor(opts) {
    this.opts = opts;
    if (opts.storage && opts.initialSnapshot) {
      throw new Error("Cannot provide both storage and initialSnapshot options");
    }
    const storage = opts.storage ? opts.storage : new InMemorySyncStorage({
      snapshot: convertStoreSnapshotToRoomSnapshot(
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        opts.initialSnapshot ?? DEFAULT_INITIAL_SNAPSHOT
      )
    });
    if ("onDataChange" in opts && opts.onDataChange) {
      this.disposables.add(
        storage.onChange(() => {
          opts.onDataChange?.();
        })
      );
    }
    this.room = new TLSyncRoom({
      onPresenceChange: opts.onPresenceChange,
      schema: opts.schema ?? createTLSchema(),
      log: opts.log,
      storage
    });
    this.storage = storage;
    this.room.events.on("session_removed", (args) => {
      this.sessions.delete(args.sessionId);
      if (this.opts.onSessionRemoved) {
        this.opts.onSessionRemoved(this, {
          sessionId: args.sessionId,
          numSessionsRemaining: this.room.sessions.size,
          meta: args.meta
        });
      }
    });
    this.log = "log" in opts ? opts.log : { error: console.error };
  }
  room;
  sessions = /* @__PURE__ */ new Map();
  log;
  storage;
  disposables = /* @__PURE__ */ new Set();
  /**
   * Returns the number of active sessions.
   * Note that this is not the same as the number of connected sockets!
   * Sessions time out a few moments after sockets close, to smooth over network hiccups.
   *
   * @returns the number of active sessions
   */
  getNumActiveSessions() {
    return this.room.sessions.size;
  }
  /**
   * Handles a new client WebSocket connection, creating a session within the room.
   * This should be called whenever a client establishes a WebSocket connection to join
   * the collaborative document.
   *
   * @param opts - Connection options
   *   - sessionId - Unique identifier for the client session (typically from browser tab)
   *   - socket - WebSocket-like object for client communication
   *   - isReadonly - Whether the client can modify the document (defaults to false)
   *   - meta - Additional session metadata (required if SessionMeta is not void)
   *
   * @example
   * ```ts
   * // Handle new WebSocket connection
   * room.handleSocketConnect({
   *   sessionId: 'user-session-abc123',
   *   socket: webSocketConnection,
   *   isReadonly: !userHasEditPermission
   * })
   * ```
   *
   * @example
   * ```ts
   * // With session metadata
   * room.handleSocketConnect({
   *   sessionId: 'session-xyz',
   *   socket: ws,
   *   meta: { userId: 'user-123', name: 'Alice' }
   * })
   * ```
   */
  handleSocketConnect(opts) {
    const { sessionId, socket, isReadonly = false } = opts;
    const handleSocketMessage = (event) => this.handleSocketMessage(sessionId, event.data);
    const handleSocketError = this.handleSocketError.bind(this, sessionId);
    const handleSocketClose = this.handleSocketClose.bind(this, sessionId);
    this.sessions.set(sessionId, {
      assembler: new JsonChunkAssembler(),
      socket,
      unlisten: () => {
        socket.removeEventListener?.("message", handleSocketMessage);
        socket.removeEventListener?.("close", handleSocketClose);
        socket.removeEventListener?.("error", handleSocketError);
      }
    });
    this.room.handleNewSession({
      sessionId,
      isReadonly,
      socket: new ServerSocketAdapter({
        ws: socket,
        onBeforeSendMessage: this.opts.onBeforeSendMessage ? (message, stringified) => this.opts.onBeforeSendMessage({
          sessionId,
          message,
          stringified,
          meta: this.room.sessions.get(sessionId)?.meta
        }) : void 0
      }),
      meta: "meta" in opts ? opts.meta : void 0
    });
    socket.addEventListener?.("message", handleSocketMessage);
    socket.addEventListener?.("close", handleSocketClose);
    socket.addEventListener?.("error", handleSocketError);
  }
  /**
   * Processes a message received from a client WebSocket. Use this method in server
   * environments where WebSocket event listeners cannot be attached directly to socket
   * instances (e.g., Bun.serve, Cloudflare Workers with WebSocket hibernation).
   *
   * The method handles message chunking/reassembly and forwards complete messages
   * to the underlying sync room for processing.
   *
   * @param sessionId - Session identifier matching the one used in handleSocketConnect
   * @param message - Raw message data from the client (string or binary)
   *
   * @example
   * ```ts
   * // In a Bun.serve handler
   * server.upgrade(req, {
   *   data: { sessionId, room },
   *   upgrade(res, req) {
   *     // Connection established
   *   },
   *   message(ws, message) {
   *     const { sessionId, room } = ws.data
   *     room.handleSocketMessage(sessionId, message)
   *   }
   * })
   * ```
   */
  handleSocketMessage(sessionId, message) {
    const assembler = this.sessions.get(sessionId)?.assembler;
    if (!assembler) {
      this.log?.warn?.("Received message from unknown session", sessionId);
      return;
    }
    try {
      const messageString = typeof message === "string" ? message : new TextDecoder().decode(message);
      const res = assembler.handleMessage(messageString);
      if (!res) {
        return;
      }
      if ("data" in res) {
        if (this.opts.onAfterReceiveMessage) {
          const session = this.room.sessions.get(sessionId);
          if (session) {
            this.opts.onAfterReceiveMessage({
              sessionId,
              message: res.data,
              stringified: res.stringified,
              meta: session.meta
            });
          }
        }
        this.room.handleMessage(sessionId, res.data);
      } else {
        this.log?.error?.("Error assembling message", res.error);
        this.handleSocketError(sessionId);
      }
    } catch (e) {
      this.log?.error?.(e);
      this.room.rejectSession(sessionId, TLSyncErrorCloseEventReason.UNKNOWN_ERROR);
    }
  }
  /**
   * Handles a WebSocket error for the specified session. Use this in server environments
   * where socket event listeners cannot be attached directly. This will initiate cleanup
   * and session removal for the affected client.
   *
   * @param sessionId - Session identifier matching the one used in handleSocketConnect
   *
   * @example
   * ```ts
   * // In a custom WebSocket handler
   * socket.addEventListener('error', () => {
   *   room.handleSocketError(sessionId)
   * })
   * ```
   */
  handleSocketError(sessionId) {
    this.room.handleClose(sessionId);
  }
  /**
   * Handles a WebSocket close event for the specified session. Use this in server
   * environments where socket event listeners cannot be attached directly. This will
   * initiate cleanup and session removal for the disconnected client.
   *
   * @param sessionId - Session identifier matching the one used in handleSocketConnect
   *
   * @example
   * ```ts
   * // In a custom WebSocket handler
   * socket.addEventListener('close', () => {
   *   room.handleSocketClose(sessionId)
   * })
   * ```
   */
  handleSocketClose(sessionId) {
    this.room.handleClose(sessionId);
  }
  /**
   * Returns the current document clock value. The clock is a monotonically increasing
   * integer that increments with each document change, providing a consistent ordering
   * of changes across the distributed system.
   *
   * @returns The current document clock value
   *
   * @example
   * ```ts
   * const clock = room.getCurrentDocumentClock()
   * console.log(`Document is at version ${clock}`)
   * ```
   */
  getCurrentDocumentClock() {
    return this.storage.getClock();
  }
  /**
   * Retrieves a deeply cloned copy of a record from the document store.
   * Returns undefined if the record doesn't exist. The returned record is
   * safe to mutate without affecting the original store data.
   *
   * @param id - Unique identifier of the record to retrieve
   * @returns Deep clone of the record, or undefined if not found
   *
   * @example
   * ```ts
   * const shape = room.getRecord('shape:abc123')
   * if (shape) {
   *   console.log('Shape position:', shape.x, shape.y)
   *   // Safe to modify without affecting store
   *   shape.x = 100
   * }
   * ```
   */
  getRecord(id) {
    return this.storage.transaction((txn) => {
      return structuredClone(txn.get(id));
    }).result;
  }
  /**
   * Returns information about all active sessions in the room. Each session
   * represents a connected client with their current connection status and metadata.
   *
   * @returns Array of session information objects containing:
   *   - sessionId - Unique session identifier
   *   - isConnected - Whether the session has an active WebSocket connection
   *   - isReadonly - Whether the session can modify the document
   *   - meta - Custom session metadata
   *
   * @example
   * ```ts
   * const sessions = room.getSessions()
   * console.log(`Room has ${sessions.length} active sessions`)
   *
   * for (const session of sessions) {
   *   console.log(`${session.sessionId}: ${session.isConnected ? 'online' : 'offline'}`)
   *   if (session.isReadonly) {
   *     console.log('  (read-only access)')
   *   }
   * }
   * ```
   */
  getSessions() {
    return [...this.room.sessions.values()].map((session) => {
      return {
        sessionId: session.sessionId,
        isConnected: session.state === RoomSessionState.Connected,
        isReadonly: session.isReadonly,
        meta: session.meta
      };
    });
  }
  /**
   * Creates a complete snapshot of the current document state, including all records
   * and synchronization metadata. This snapshot can be persisted to storage and used
   * to restore the room state later or revert to a previous version.
   *
   * @returns Complete room snapshot including documents, clock values, and tombstones
   * @deprecated if you need to do this use
   *
   * @example
   * ```ts
   * // Capture current state for persistence
   * const snapshot = room.getCurrentSnapshot()
   * await saveToDatabase(roomId, JSON.stringify(snapshot))
   *
   * // Later, restore from snapshot
   * const savedSnapshot = JSON.parse(await loadFromDatabase(roomId))
   * const newRoom = new TLSocketRoom({ initialSnapshot: savedSnapshot })
   * ```
   */
  getCurrentSnapshot() {
    if (this.storage.getSnapshot) {
      return this.storage.getSnapshot();
    }
    throw new Error("getCurrentSnapshot is not supported for this storage type");
  }
  /**
   * Retrieves all presence records from the document store. Presence records
   * contain ephemeral user state like cursor positions and selections.
   *
   * @returns Object mapping record IDs to presence record data
   * @internal
   */
  getPresenceRecords() {
    const result = {};
    for (const presence of this.room.presenceStore.values()) {
      result[presence.id] = presence;
    }
    return result;
  }
  /**
   * Loads a document snapshot, completely replacing the current room state.
   * This will disconnect all current clients and update the document to match
   * the provided snapshot. Use this for restoring from backups or implementing
   * document versioning.
   *
   * @param snapshot - Room or store snapshot to load
   *
   * @example
   * ```ts
   * // Restore from a saved snapshot
   * const backup = JSON.parse(await loadBackup(roomId))
   * room.loadSnapshot(backup)
   *
   * // All clients will be disconnected and need to reconnect
   * // to see the restored document state
   * ```
   */
  loadSnapshot(snapshot) {
    this.storage.transaction((txn) => {
      loadSnapshotIntoStorage(txn, this.room.schema, snapshot);
    });
  }
  /**
   * Executes a transaction to modify the document store. Changes made within the
   * transaction are atomic and will be synchronized to all connected clients.
   * The transaction provides isolation from concurrent changes until it commits.
   *
   * @param updater - Function that receives store methods to make changes
   *   - store.get(id) - Retrieve a record (safe to mutate, but must call put() to commit)
   *   - store.put(record) - Save a modified record
   *   - store.getAll() - Get all records in the store
   *   - store.delete(id) - Remove a record from the store
   * @returns Promise that resolves when the transaction completes
   *
   * @example
   * ```ts
   * // Update multiple shapes in a single transaction
   * await room.updateStore(store => {
   *   const shape1 = store.get('shape:abc123')
   *   const shape2 = store.get('shape:def456')
   *
   *   if (shape1) {
   *     shape1.x = 100
   *     store.put(shape1)
   *   }
   *
   *   if (shape2) {
   *     shape2.meta.approved = true
   *     store.put(shape2)
   *   }
   * })
   * ```
   *
   * @example
   * ```ts
   * // Async transaction with external API call
   * await room.updateStore(async store => {
   *   const doc = store.get('document:main')
   *   if (doc) {
   *     doc.lastModified = await getCurrentTimestamp()
   *     store.put(doc)
   *   }
   * })
   * ```
   * @deprecated use the storage.transaction method instead
   */
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  async updateStore(updater) {
    if (this.isClosed()) {
      throw new Error("Cannot update store on a closed room");
    }
    const ctx = new StoreUpdateContext(
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      Object.fromEntries(this.getCurrentSnapshot().documents.map((d) => [d.state.id, d.state])),
      this.room.schema
    );
    try {
      await updater(ctx);
    } finally {
      ctx.close();
    }
    this.storage.transaction((txn) => {
      for (const [id, record] of Object.entries(ctx.updates.puts)) {
        txn.set(id, record);
      }
      for (const id of ctx.updates.deletes) {
        txn.delete(id);
      }
    });
  }
  /**
   * Sends a custom message to a specific client session. This allows sending
   * application-specific data that doesn't modify the document state, such as
   * notifications, chat messages, or custom commands.
   *
   * @param sessionId - Target session identifier
   * @param data - Custom payload to send (will be JSON serialized)
   *
   * @example
   * ```ts
   * // Send a notification to a specific user
   * room.sendCustomMessage('session-123', {
   *   type: 'notification',
   *   message: 'Your changes have been saved'
   * })
   *
   * // Send a chat message
   * room.sendCustomMessage('session-456', {
   *   type: 'chat',
   *   from: 'Alice',
   *   text: 'Great work on this design!'
   * })
   * ```
   */
  sendCustomMessage(sessionId, data) {
    this.room.sendCustomMessage(sessionId, data);
  }
  /**
   * Immediately removes a session from the room and closes its WebSocket connection.
   * The client will attempt to reconnect automatically unless a fatal reason is provided.
   *
   * @param sessionId - Session identifier to remove
   * @param fatalReason - Optional fatal error reason that prevents reconnection
   *
   * @example
   * ```ts
   * // Kick a user (they can reconnect)
   * room.closeSession('session-troublemaker')
   *
   * // Permanently ban a user
   * room.closeSession('session-banned', 'PERMISSION_DENIED')
   *
   * // Close session due to inactivity
   * room.closeSession('session-idle', 'TIMEOUT')
   * ```
   */
  closeSession(sessionId, fatalReason) {
    this.room.rejectSession(sessionId, fatalReason);
  }
  /**
   * Closes the room and disconnects all connected clients. This should be called
   * when shutting down the room permanently, such as during server shutdown or
   * when the room is no longer needed. Once closed, the room cannot be reopened.
   *
   * @example
   * ```ts
   * // Clean shutdown when no users remain
   * if (room.getNumActiveSessions() === 0) {
   *   await persistSnapshot(room.getCurrentSnapshot())
   *   room.close()
   * }
   *
   * // Server shutdown
   * process.on('SIGTERM', () => {
   *   for (const room of activeRooms.values()) {
   *     room.close()
   *   }
   * })
   * ```
   */
  close() {
    this.room.close();
    this.disposables.forEach((d) => d());
    this.disposables.clear();
  }
  /**
   * Checks whether the room has been permanently closed. Closed rooms cannot
   * accept new connections or process further changes.
   *
   * @returns True if the room is closed, false if still active
   *
   * @example
   * ```ts
   * if (room.isClosed()) {
   *   console.log('Room has been shut down')
   *   // Create a new room or redirect users
   * } else {
   *   // Room is still accepting connections
   *   room.handleSocketConnect({ sessionId, socket })
   * }
   * ```
   */
  isClosed() {
    return this.room.isClosed();
  }
};
var StoreUpdateContext = class {
  constructor(snapshot, schema) {
    this.snapshot = snapshot;
    this.schema = schema;
  }
  updates = {
    puts: {},
    deletes: /* @__PURE__ */ new Set()
  };
  put(record) {
    if (this._isClosed) throw new Error("StoreUpdateContext is closed");
    const recordType = getOwnProperty(this.schema.types, record.typeName);
    if (!recordType) {
      throw new Error(`Missing definition for record type ${record.typeName}`);
    }
    const recordBefore = this.snapshot[record.id] ?? void 0;
    recordType.validate(record, recordBefore);
    if (record.id in this.snapshot && (0, import_lodash.default)(this.snapshot[record.id], record)) {
      delete this.updates.puts[record.id];
    } else {
      this.updates.puts[record.id] = structuredClone(record);
    }
    this.updates.deletes.delete(record.id);
  }
  delete(recordOrId) {
    if (this._isClosed) throw new Error("StoreUpdateContext is closed");
    const id = typeof recordOrId === "string" ? recordOrId : recordOrId.id;
    delete this.updates.puts[id];
    if (this.snapshot[id]) {
      this.updates.deletes.add(id);
    }
  }
  get(id) {
    if (this._isClosed) throw new Error("StoreUpdateContext is closed");
    if (hasOwnProperty(this.updates.puts, id)) {
      return structuredClone(this.updates.puts[id]);
    }
    if (this.updates.deletes.has(id)) {
      return null;
    }
    return structuredClone(this.snapshot[id] ?? null);
  }
  getAll() {
    if (this._isClosed) throw new Error("StoreUpdateContext is closed");
    const result = Object.values(this.updates.puts);
    for (const [id, record] of Object.entries(this.snapshot)) {
      if (!this.updates.deletes.has(id) && !hasOwnProperty(this.updates.puts, id)) {
        result.push(record);
      }
    }
    return structuredClone(result);
  }
  _isClosed = false;
  close() {
    this._isClosed = true;
  }
};

// node_modules/@tldraw/sync-core/dist-esm/index.mjs
registerTldrawLibraryVersion(
  "@tldraw/sync-core",
  "4.5.12",
  "esm"
);

// node_modules/@tldraw/sync/dist-esm/useSync.mjs
var import_react = __toESM(require_react(), 1);
var MULTIPLAYER_EVENT_NAME = "multiplayer.client";
var defaultCustomMessageHandler = () => {
};
function useSync(opts) {
  const [state, setState] = useRefState(null);
  const {
    uri,
    roomId = "default",
    assets,
    onMount,
    connect,
    trackAnalyticsEvent: track,
    userInfo,
    getUserPresence: _getUserPresence,
    onCustomMessageReceived: _onCustomMessageReceived,
    ...schemaOpts
  } = opts;
  const __never__ = 0;
  const schema = useTLSchemaFromUtils(schemaOpts);
  const prefs = useShallowObjectIdentity(userInfo);
  const getUserPresence = useReactiveEvent(
    _getUserPresence ?? getDefaultUserPresence
  );
  const onCustomMessageReceived = useEvent(_onCustomMessageReceived ?? defaultCustomMessageHandler);
  const userAtom = useAtom(
    "userAtom",
    prefs
  );
  (0, import_react.useEffect)(() => {
    userAtom.set(prefs);
  }, [prefs, userAtom]);
  (0, import_react.useEffect)(() => {
    const storeId = uniqueId();
    const userPreferences = computed(
      "userPreferences",
      () => {
        const userStuff = userAtom.get();
        const user = (isSignal(userStuff) ? userStuff.get() : userStuff) ?? getUserPreferences();
        return {
          id: user.id,
          color: user.color ?? defaultUserPreferences.color,
          name: user.name ?? defaultUserPreferences.name
        };
      }
    );
    let socket;
    if (connect) {
      if (uri) {
        throw new Error("uri and connect cannot be used together");
      }
      socket = connect({
        sessionId: TAB_ID,
        storeId
      });
    } else if (uri) {
      if (connect) {
        throw new Error("uri and connect cannot be used together");
      }
      socket = new ClientWebSocketAdapter(async () => {
        const uriString = typeof uri === "string" ? uri : await uri();
        const withParams = new URL(uriString);
        if (withParams.searchParams.has("sessionId")) {
          throw new Error(
            'useSync. "sessionId" is a reserved query param name. Please use a different name'
          );
        }
        if (withParams.searchParams.has("storeId")) {
          throw new Error(
            'useSync. "storeId" is a reserved query param name. Please use a different name'
          );
        }
        withParams.searchParams.set("sessionId", TAB_ID);
        withParams.searchParams.set("storeId", storeId);
        return withParams.toString();
      });
    } else {
      throw new Error("uri or connect must be provided");
    }
    let didCancel = false;
    function getConnectionStatus() {
      return socket.connectionStatus === "error" ? "offline" : socket.connectionStatus;
    }
    const collaborationStatusSignal = atom("collaboration status", getConnectionStatus());
    const unsubscribeFromConnectionStatus = socket.onStatusChange(() => {
      collaborationStatusSignal.set(getConnectionStatus());
    });
    const syncMode = atom("sync mode", "readwrite");
    const store = createTLStore({
      id: storeId,
      schema,
      assets,
      onMount,
      collaboration: {
        status: collaborationStatusSignal,
        mode: syncMode
      }
    });
    const presence = computed("instancePresence", () => {
      const presenceState = getUserPresence(store, userPreferences.get());
      if (!presenceState) return null;
      return InstancePresenceRecordType.create({
        ...presenceState,
        id: InstancePresenceRecordType.createId(store.id)
      });
    });
    const otherUserPresences = store.query.ids("instance_presence", () => ({
      userId: { neq: userPreferences.get().id }
    }));
    const presenceMode = computed("presenceMode", () => {
      if (otherUserPresences.get().size === 0) return "solo";
      return "full";
    });
    const client = new TLSyncClient({
      store,
      socket,
      didCancel: () => didCancel,
      onLoad(client2) {
        track?.(MULTIPLAYER_EVENT_NAME, { name: "load", roomId });
        setState({ readyClient: client2 });
      },
      onSyncError(reason) {
        console.error("sync error", reason);
        switch (reason) {
          case TLSyncErrorCloseEventReason.NOT_FOUND:
            track?.(MULTIPLAYER_EVENT_NAME, { name: "room-not-found", roomId });
            break;
          case TLSyncErrorCloseEventReason.FORBIDDEN:
            track?.(MULTIPLAYER_EVENT_NAME, { name: "forbidden", roomId });
            break;
          case TLSyncErrorCloseEventReason.NOT_AUTHENTICATED:
            track?.(MULTIPLAYER_EVENT_NAME, { name: "not-authenticated", roomId });
            break;
          case TLSyncErrorCloseEventReason.RATE_LIMITED:
            track?.(MULTIPLAYER_EVENT_NAME, { name: "rate-limited", roomId });
            break;
          default:
            track?.(MULTIPLAYER_EVENT_NAME, { name: "sync-error:" + reason, roomId });
            break;
        }
        setState({ error: new TLRemoteSyncError(reason) });
        socket.close();
      },
      onAfterConnect(_, { isReadonly }) {
        transact(() => {
          syncMode.set(isReadonly ? "readonly" : "readwrite");
          store.ensureStoreIsUsable();
        });
      },
      onCustomMessageReceived,
      presence,
      presenceMode
    });
    return () => {
      didCancel = true;
      unsubscribeFromConnectionStatus();
      client.close();
      socket.close();
    };
  }, [
    assets,
    onMount,
    connect,
    userAtom,
    roomId,
    schema,
    setState,
    track,
    uri,
    getUserPresence,
    onCustomMessageReceived
  ]);
  return useValue(
    "remote synced store",
    () => {
      if (!state) return { status: "loading" };
      if (state.error) return { status: "error", error: state.error };
      if (!state.readyClient) return { status: "loading" };
      const connectionStatus = state.readyClient.socket.connectionStatus;
      return {
        status: "synced-remote",
        connectionStatus: connectionStatus === "error" ? "offline" : connectionStatus,
        store: state.readyClient.store
      };
    },
    [state]
  );
}

// node_modules/@tldraw/sync/dist-esm/useSyncDemo.mjs
var import_react2 = __toESM(require_react(), 1);
function getEnv(cb) {
  try {
    return cb();
  } catch {
    return void 0;
  }
}
var DEMO_WORKER = getEnv(() => "https://demo.tldraw.xyz") ?? "https://demo.tldraw.xyz";
var IMAGE_WORKER = getEnv(() => process.env.TLDRAW_IMAGE_URL) ?? "https://images.tldraw.xyz";
function useSyncDemo(options) {
  const { roomId, host = DEMO_WORKER, ..._syncOpts } = options;
  const assets = (0, import_react2.useMemo)(() => createDemoAssetStore(host), [host]);
  const syncOpts = useShallowObjectIdentity(_syncOpts);
  const syncOptsWithDefaults = (0, import_react2.useMemo)(() => {
    if ("schema" in syncOpts && syncOpts.schema) return syncOpts;
    return {
      ...syncOpts,
      shapeUtils: "shapeUtils" in syncOpts ? [...defaultShapeUtils, ...syncOpts.shapeUtils ?? []] : defaultShapeUtils,
      bindingUtils: "bindingUtils" in syncOpts ? [...defaultBindingUtils, ...syncOpts.bindingUtils ?? []] : defaultBindingUtils
    };
  }, [syncOpts]);
  return useSync({
    uri: `${host}/connect/${encodeURIComponent(roomId)}`,
    roomId,
    assets,
    onMount: (0, import_react2.useCallback)(
      (editor) => {
        editor.registerExternalAssetHandler("url", async ({ url }) => {
          return await createAssetFromUrlUsingDemoServer(host, url);
        });
      },
      [host]
    ),
    ...syncOptsWithDefaults
  });
}
function shouldDisallowUploads(host) {
  const disallowedHosts = ["tldraw.com", "tldraw.xyz"];
  return disallowedHosts.some(
    (disallowedHost) => host === disallowedHost || host.endsWith(`.${disallowedHost}`)
  );
}
function createDemoAssetStore(host) {
  return {
    upload: async (_asset, file) => {
      if (shouldDisallowUploads(host)) {
        alert("Uploading images is disabled in this demo.");
        throw new Error("Uploading images is disabled in this demo.");
      }
      const id = uniqueId();
      const objectName = `${id}-${file.name}`.replace(/\W/g, "-");
      const url = `${host}/uploads/${objectName}`;
      await fetch(url, {
        method: "POST",
        body: file
      });
      return { src: url };
    },
    resolve(asset, context) {
      if (!asset.props.src) return null;
      if (asset.type === "video") return asset.props.src;
      if (asset.type !== "image") return null;
      if (!asset.props.src.startsWith("http:") && !asset.props.src.startsWith("https:"))
        return asset.props.src;
      if (context.shouldResolveToOriginal) return asset.props.src;
      if (MediaHelpers.isAnimatedImageType(asset?.props.mimeType) || asset.props.isAnimated)
        return asset.props.src;
      if (MediaHelpers.isVectorImageType(asset?.props.mimeType)) return asset.props.src;
      const url = new URL(asset.props.src);
      const isTldrawImage = url.origin === host || /\.tldraw\.(?:com|xyz|dev|workers\.dev)$/.test(url.host);
      if (!isTldrawImage) return asset.props.src;
      const { fileSize = 0 } = asset.props;
      const isWorthResizing = fileSize >= 1024 * 1024 * 1.5;
      if (isWorthResizing) {
        const networkCompensation = !context.networkEffectiveType || context.networkEffectiveType === "4g" ? 1 : 0.5;
        const pixelRatio = asset.props.pixelRatio ?? 1;
        const trueWidth = asset.props.w * pixelRatio;
        const width = Math.ceil(
          Math.min(
            trueWidth * clamp(context.steppedScreenScale, 1 / 32, 1) * networkCompensation * context.dpr,
            trueWidth
          )
        );
        url.searchParams.set("w", width.toString());
      }
      const newUrl = `${IMAGE_WORKER}/${url.host}/${url.toString().slice(url.origin.length + 1)}`;
      return newUrl;
    }
  };
}
async function createAssetFromUrlUsingDemoServer(host, url) {
  const urlHash = getHashForString(url);
  try {
    const fetchUrl = new URL(`${host}/bookmarks/unfurl`);
    fetchUrl.searchParams.set("url", url);
    const meta = await (await fetch(fetchUrl, { method: "POST" })).json();
    return {
      id: AssetRecordType.createId(urlHash),
      typeName: "asset",
      type: "bookmark",
      props: {
        src: url,
        description: meta?.description ?? "",
        image: meta?.image ?? "",
        favicon: meta?.favicon ?? "",
        title: meta?.title ?? ""
      },
      meta: {}
    };
  } catch (error) {
    console.error(error);
    return {
      id: AssetRecordType.createId(urlHash),
      typeName: "asset",
      type: "bookmark",
      props: {
        src: url,
        description: "",
        image: "",
        favicon: "",
        title: ""
      },
      meta: {}
    };
  }
}

// node_modules/@tldraw/sync/dist-esm/index.mjs
registerTldrawLibraryVersion(
  "@tldraw/sync",
  "4.5.12",
  "esm"
);
export {
  ClientWebSocketAdapter,
  DEFAULT_INITIAL_SNAPSHOT,
  DurableObjectSqliteSyncWrapper,
  InMemorySyncStorage,
  JsonChunkAssembler,
  NodeSqliteWrapper,
  ReconnectManager,
  RecordOpType,
  RoomSessionState,
  SQLiteSyncStorage,
  TLIncompatibilityReason,
  TLRemoteSyncError,
  TLSocketRoom,
  TLSyncClient,
  TLSyncErrorCloseEventCode,
  TLSyncErrorCloseEventReason,
  TLSyncRoom,
  ValueOpType,
  applyObjectDiff,
  chunk,
  diffRecord,
  getNetworkDiff,
  getTlsyncProtocolVersion,
  loadSnapshotIntoStorage,
  useSync,
  useSyncDemo
};
//# sourceMappingURL=@tldraw_sync.js.map
