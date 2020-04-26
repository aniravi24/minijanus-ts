export interface JanusError {
  // an error could contain many other things, not typed yet
  [x: string]: any;
  code: JanusErrorCode;
  reason: string;
}

export type JanusErrorCode =
  | 0
  | 403
  | 405
  | 490
  | 450
  | 452
  | 453
  | 454
  | 455
  | 456
  | 457
  | 458
  | 460
  | 461
  | 462
  | 463
  | 464
  | 465
  | 466
  | 467
  | 468
  | 469
  | 470
  | 471
  | 472;

export interface JanusErrorResponse {
  // an error could contain many other things, not typed yet
  [x: string]: any;
  janus: "error";
  transaction: string;
  error: JanusError;
}

export interface JanusSuccessResponse {
  janus: "success";
  transaction: string;
  data: {
    id: string;
  };
}

export interface JanusDestroyRequest {
  janus: "destroy";
  transaction: string;
}

export interface JanusTrickle {
  janus: "trickle";
  transaction: string;
}

export interface JanusTrickleCandidate extends JanusTrickle {
  candidate: any;
}

export interface JanusTrickleCandidates extends JanusTrickle {
  candidates: any[];
}

export interface JanusAck {
  janus: "ack";
  transaction: string;
}

export interface JanusDetach {
  janus: "detach";
  transaction: string;
}

export interface JanusHangup {
  janus: "hangup";
  transaction: string;
}

export interface JanusCreateRoomSuccessResponse {
  plugindata: {
    data: {
      videoroom: "created";
      room: string;
      permanent: Boolean;
    };
  };
}

export type JanusSuccessAttachResponse = JanusSuccessResponse;
export type JanusSuccessCreateResponse = JanusSuccessResponse;

export type JanusAttachResponse =
  | JanusSuccessAttachResponse
  | JanusErrorResponse;

export type JanusPluginString = string;
export type JanusEvent = string;

export type JanusSessionOptions = {
  verbose?: boolean;
  apisecret?: string;
  timeoutMs?: number;
  keepaliveMs?: number;
  keepAliveRetries?: number;
  multiSession?: boolean;
};
