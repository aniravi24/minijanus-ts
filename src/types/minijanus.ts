interface JanusError {
  code:
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
  reason: string;
}

interface JanusErrorResponse {
  janus: "error";
  transaction: string;
  error: JanusError;
}

interface JanusSuccessResponse {
  janus: "success";
  transaction: string;
  data: {
    id: string;
  };
}

interface JanusDestroyRequest {
  janus: "destroy";
  transaction: string;
}

interface JanusTrickle {
  janus: "trickle";
  transaction: string;
}

interface JanusTrickleCandidate extends JanusTrickle {
  candidate: any;
}

interface JanusTrickleCandidates extends JanusTrickle {
  candidates: any[];
}

interface JanusAck {
  janus: "ack";
  transaction: string;
}

interface JanusDetach {
  janus: "detach";
  transaction: string;
}

interface JanusHangup {
  janus: "hangup";
  transaction: string;
}

interface JanusCreateRoomSuccessResponse {
  videoroom: "created";
  room: string;
  permanent: Boolean;
}

type JanusSuccessAttachResponse = JanusSuccessResponse;
type JanusSuccessCreateResponse = JanusSuccessResponse;

type JanusAttachResponse = JanusSuccessAttachResponse | JanusErrorResponse;

type JanusPluginString = string;
type JanusEvent = string;
