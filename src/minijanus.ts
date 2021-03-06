/**
 * Represents a handle to a single Janus plugin on a Janus session. Each WebRTC connection to the Janus server will be
 * associated with a single handle. Once attached to the server, this handle will be given a unique ID which should be
 * used to associate it with future signalling messages.
 *
 * See https://janus.conf.meetecho.com/docs/rest.html#handles.
 **/
import { v4 as uuidv4 } from "uuid";
import {
  JanusPluginString,
  JanusSuccessAttachResponse,
  JanusEvent,
  JanusCreateRoomSuccessResponse,
  JanusSuccessCreateResponse,
  JanusErrorResponse,
  JanusSessionOptions,
} from "./types";

export class JanusPluginHandle {
  roomId: string | undefined;
  id: string | number | undefined;
  session: JanusSession;
  feedId: string | number | undefined;

  constructor(session: JanusSession) {
    this.session = session;
    this.id = undefined;
    this.roomId = undefined;
    this.feedId = undefined;
  }

  toJSON() {
    return {
      roomId: this.roomId,
      id: this.id,
      feedId: this.feedId,
    };
  }

  /** Attaches this handle to the Janus server and sets its ID. **/
  async attach(plugin: JanusPluginString) {
    var payload = {
      plugin: plugin,
      "force-bundle": true,
      "force-rtcp-mux": true,
    };
    const resp = await this.session.send("attach", payload);
    this.id = (resp as JanusSuccessAttachResponse).data.id;
    return resp;
  }

  /** Janus usually will automatically handle this, but the client can send a hangup event */
  hangup() {
    return this.send("hangup");
  }

  /** Detaches this handle. **/
  detach() {
    return this.send("detach");
  }

  /** Registers a callback to be fired upon the reception of any incoming Janus signals for this plugin handle with the
   * `janus` attribute equal to `ev`.
   **/
  on(ev: string, callback: Function) {
    return this.session.on(ev, (signal: any) => {
      if (signal.sender == this.id) {
        callback(signal);
      }
    });
  }

  /**
   * Sends a signal associated with this handle. Signals should be JSON-serializable objects. Returns a promise that will
   * be resolved or rejected when a response to this signal is received, or when no response is received within the
   * session timeout.
   **/
  send(type: JanusEvent, signal?: any) {
    return this.session.send(
      type,
      Object.assign({ handle_id: this.id }, signal)
    );
  }

  /** Sends a plugin-specific message associated with this handle. **/
  sendMessage(body: any) {
    return this.send("message", { body: body });
  }

  /** For Janus videoroom plugin, create a room */
  async createRoom() {
    const resp = await this.send("message", { body: { request: "create" } });
    this.roomId = (resp as JanusCreateRoomSuccessResponse).plugindata.data.room;
  }
  /** For Janus videoroom plugin, join as a publisher (as in, a client streaming media into the room) */
  joinPublisher() {
    return this.send("message", {
      body: { request: "join", ptype: "publisher", room: this.roomId },
    });
  }

  /** Sends a JSEP offer or answer associated with this handle. **/
  sendJsep(jsep: any, body?: any) {
    return this.send("message", { body: body ? body : {}, jsep: jsep });
  }

  /** Sends an ICE trickle candidate associated with this handle. **/
  sendTrickle(candidate: any | any[]) {
    if (candidate instanceof Array) {
      return this.send("trickle", { candidates: candidate });
    }
    return this.send("trickle", { candidate: candidate });
  }
}

/**
 * Represents a Janus session -- a Janus context from within which you can open multiple handles and connections. Once
 * created, this session will be given a unique ID which should be used to associate it with future signalling messages.
 *
 * See https://janus.conf.meetecho.com/docs/rest.html#sessions.
 **/

export class JanusSession {
  output: any;
  id: string | undefined;
  txns: any;
  eventHandlers: any;
  options: JanusSessionOptions;
  keepaliveTimeout?: NodeJS.Timeout;
  keepAlivesTried: number;
  cb: ((log: { type: string; data: any }) => any) | undefined;

  constructor(
    output: any,
    options?: JanusSessionOptions,
    cb?: (log: { type: string; data: any }) => any
  ) {
    this.output = output;
    this.id = undefined;
    this.txns = {};
    this.eventHandlers = {};
    this.options = Object.assign(
      {
        verbose: false,
        timeoutMs: 10000,
        keepaliveMs: 30000,
      },
      options
    );
    this.cb = cb;
    this.keepAlivesTried = 0;
  }

  toJSON() {
    return {
      id: this.id,
      options: this.options,
      keepAlivesTried: this.keepAlivesTried,
    };
  }

  private _logOutput(type: string, args: any) {
    switch (type) {
      case "warn": {
        if (this.cb) this.cb({ type: "warn", data: args });
        else console.warn(args);
        break;
      }
      case "debug": {
        if (this.cb) this.cb({ type: "debug", data: args });
        else console.debug(args);
        break;
      }
      case "error": {
        if (this.cb) this.cb({ type: "error", data: args });
        else console.error(args);
        break;
      }
    }
  }

  /** Creates this session on the Janus server and sets its ID. **/
  async create() {
    const resp = (await this.send("create")) as JanusSuccessCreateResponse;
    this.id = resp.data.id;
    return resp;
  }

  /**
   * Destroys this session. Note that upon destruction, Janus will also close the signalling transport (if applicable) and
   * any open WebRTC connections.
   **/
  async destroy() {
    const resp = await this.send("destroy");
    this.dispose();
    return resp;
  }

  /**
   * Disposes of this session in a way such that no further incoming signalling messages will be processed.
   * Outstanding transactions will be rejected.
   **/
  dispose() {
    this._killKeepalive();
    this.eventHandlers = {};
    for (var txId in this.txns) {
      if (this.txns.hasOwnProperty(txId)) {
        var txn = this.txns[txId];
        clearTimeout(txn.timeout);
        txn.reject(new Error("Janus session was disposed."));
        delete this.txns[txId];
      }
    }
  }
  /**
   * Whether this signal represents an error, and the associated promise (if any) should be rejected.
   * Users should override this to handle any custom plugin-specific error conventions.
   **/
  isError(signal: { janus: string }) {
    return signal.janus === "error";
  }
  /** Registers a callback to be fired upon the reception of any incoming Janus signals for this session with the
   * `janus` attribute equal to `ev`.
   **/
  on(ev: string, callback: Function) {
    var handlers = this.eventHandlers[ev];
    if (handlers == null) {
      handlers = this.eventHandlers[ev] = [];
    }
    handlers.push(callback);
  }

  /**
   * Callback for receiving JSON signalling messages pertinent to this session. If the signals are responses to previously
   * sent signals, the promises for the outgoing signals will be resolved or rejected appropriately with this signal as an
   * argument.
   *
   * External callers should call this function every time a new signal arrives on the transport; for example, in a
   * WebSocket's `message` event, or when a new datum shows up in an HTTP long-polling response.
   **/
  receive(signal: any) {
    if (this.options.multiSession && signal.session_id != this.id) {
      if (this.options.verbose) {
        this._logOutput(
          "debug",
          `Janus multi-session enabled: ${signal.session_id} ignored as this class instance's current session id is ${this.id}.`
        );
      }
      return;
    }
    if (this.options.verbose) {
      this._logIncoming(signal);
    }
    if (signal.session_id != this.id) {
      this._logOutput(
        "warn",
        "Incorrect session ID received in Janus signalling message: was " +
          signal.session_id +
          ", expected " +
          this.id +
          "."
      );
    }

    var responseType = signal.janus;
    var handlers = this.eventHandlers[responseType];
    if (handlers != null) {
      for (var i = 0; i < handlers.length; i++) {
        handlers[i](signal);
      }
    }

    if (signal.transaction != null) {
      var txn = this.txns[signal.transaction];
      if (txn == null) {
        // this is a response to a transaction that wasn't caused via JanusSession.send, or a plugin replied twice to a
        // single request, or the session was disposed, or something else that isn't under our purview; that's fine
        return;
      }

      if (responseType === "ack" && txn.type == "message") {
        // this is an ack of an asynchronously-processed plugin request, we should wait to resolve the promise until the
        // actual response comes in
        return;
      }

      clearTimeout(txn.timeout);

      delete this.txns[signal.transaction];
      (this.isError(signal) ? txn.reject : txn.resolve)(signal);
    }
  }

  /**
   * Sends a signal associated with this session, beginning a new transaction. Returns a promise that will be resolved or
   * rejected when a response is received in the same transaction, or when no response is received within the session
   * timeout.
   **/
  send(type: JanusEvent, signal?: any) {
    signal = Object.assign(
      { transaction: uuidv4(), apisecret: this.options.apisecret },
      signal
    );
    return new Promise((resolve, reject) => {
      var timeout = null;
      if (this.options.timeoutMs) {
        timeout = setTimeout(() => {
          delete this.txns[signal.transaction];
          reject(
            new Error(
              "Signalling transaction with txid " +
                signal.transaction +
                " timed out."
            )
          );
        }, this.options.timeoutMs);
      }
      this.txns[signal.transaction] = {
        resolve: resolve,
        reject: reject,
        timeout: timeout,
        type: type,
      };
      this._transmit(type, signal);
    });
  }

  private _transmit(type: string, signal: any) {
    signal = Object.assign({ janus: type }, signal);

    if (this.id != null) {
      // this.id is undefined in the special case when we're sending the session create message
      signal = Object.assign({ session_id: this.id }, signal);
    }

    if (this.options.verbose) {
      this._logOutgoing(signal);
    }

    this.output(JSON.stringify(signal));
    this.resetKeepalive();
  }

  private _logOutgoing(signal: {
    janus: string;
    jsep: { type: string };
    transaction: string;
  }) {
    var kind = signal.janus;
    if (kind === "message" && signal.jsep) {
      kind = signal.jsep.type;
    }
    var message =
      "> Outgoing Janus " +
      (kind || "signal") +
      " (#" +
      signal.transaction +
      "): ";
    this._logOutput("debug", { message, signal });
  }

  private _logIncoming(signal: { janus: string; transaction: string }) {
    var kind = signal.janus;
    var message = signal.transaction
      ? "< Incoming Janus " +
        (kind || "signal") +
        " (#" +
        signal.transaction +
        "): "
      : "< Incoming Janus " + (kind || "signal") + ": ";
    this._logOutput("debug", { message, signal });
  }

  private _sendKeepalive() {
    return this.send("keepalive");
  }

  private _killKeepalive() {
    if (this.keepaliveTimeout) clearTimeout(this.keepaliveTimeout);
  }

  resetKeepalive() {
    this.keepAlivesTried = 0;
    this._killKeepalive();
    if (this.options.keepaliveMs) {
      this.keepaliveTimeout = setTimeout(() => {
        this._sendKeepalive().catch((e: JanusErrorResponse) => {
          this._logOutput("error", {
            message: "Error received from keepalive: ",
            stack: e,
          });
          if (this.options.keepAliveRetries) {
            if (this.keepAlivesTried > this.options.keepAliveRetries) {
              this._logOutput("error", {
                message: "Keep alive retry limit reached. Disposing session.",
                session: this.id,
              });
              this.dispose();
              this.keepAlivesTried = 0;
            } else {
              this.keepAlivesTried += 1;
              this._logOutput("warn", {
                message: `Keep alive failed. This will retry ${
                  this.options.keepAliveRetries - this.keepAlivesTried
                } more times, unless the session doesn't exist anymore.`,
                session: this.id,
              });
            }
          }
          switch (e?.error?.code) {
            // session doesn't exist
            case 458: {
              this.dispose();
              this._logOutput("error", {
                message: "Disposing non-existent session",
                session: e.session_id,
              });
              break;
            }
          }
        });
      }, this.options.keepaliveMs);
    }
  }
}
