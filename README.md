# minijanus-ts

Forked from [Minijanus.js](https://github.com/mozilla/minijanus.js). This adds TypeScript support, moves to Yarn and Jest from NPM and Tape, and is adding support for plugins as needed. Currently, it adds the videoroom plugin.

## Description below is from the minijanus README:

A super-simplistic and -minimal wrapper for talking to the [Janus signalling API][api-docs]. Developed for use with
Janus as a web game networking backend via [janus-plugin-sfu][], but fundamentally plugin-agnostic. Designed to
provide useful possible abstractions while still providing the maximum possible control over `RTCPeerConnection`
configuration and precise plugin signalling flow.

If you want a batteries-included wrapper, you should use the one distributed by the Janus developers --
[janus.js][]. This one is different in a few ways:

1. It doesn't try to maintain compatibility with older browsers very hard; the use case is modern browsers only.
2. It's very small and straightforward, so it may serve as a useful reference client for people who want to better
   understand the signalling API.
3. It gives you control over most of the configuration and usage of the `RTCPeerConnection` directly, whereas janus.js
   wraps and manages the connection for you.

If you want a similar but moderately more featureful wrapper, check out [minnie-janus][].

[api-docs]: https://janus.conf.meetecho.com/docs/rest.html
[janus.js]: https://github.com/meetecho/janus-gateway/blob/master/html/janus.js
[janus-plugin-sfu]: https://github.com/mquander/janus-plugin-sfu
[minnie-janus]: https://github.com/michaelfranzl/minnie-janus

## Example

Require `minijanus-ts`. It should work with ES6 (or greater) or CommonJS syntax.

```javascript
var ws = new WebSocket("ws://localhost:8188", "janus-protocol");
var session = new JanusSession(ws.send.bind(ws));
var handle = new JanusPluginHandle(session);
var conn = new RTCPeerConnection({});

ws.addEventListener("message", ev => session.receive(JSON.parse(ev.data)));
ws.addEventListener("open", _ => {
  session.create()
    .then(_ => handle.attach("janus.plugin.sfu"))
    .then(_ => {
      conn.addEventListener("icecandidate", ev => {
        handle.sendTrickle(ev.candidate || null).catch(e => console.error("Error trickling ICE: ", e));
      });
      conn.addEventListener("negotiationneeded", _ => {
        var offer = conn.createOffer();
        var local = offer.then(o => conn.setLocalDescription(o));
        var remote = offer.then(j => handle.sendJsep(j)).then(r => conn.setRemoteDescription(r.jsep));
        Promise.all([local, remote]).catch(e => console.error("Error negotiating offer: ", e));
      });
      var unreliableCh = conn.createDataChannel("unreliable", { ordered: false, maxRetransmits: 0 });
      var reliableCh = conn.createDataChannel("reliable", { ordered: true });
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(m => m.getTracks().forEach(t => conn.addTrack(t, m)))
        .catch(e => console.error("Error acquiring media: ", e));
      return new Promise(resolve => handle.on("webrtcup", resolve));
    })
    .then(_ => { console.info("Connected to Janus: ", conn); })
    .catch(e => { console.error("Error connecting to Janus: ", e); });
});
```

(Note that this example code first negotiates only the data channels, and then renegotiates afterward when the
microphone permission is provided. Only recent versions of Janus support renegotiation. If you didn't want this, you
would instead wait to create the connection until the microphone permission was granted.)

## Building

```
$ yarn build
```

## Testing

```
$ yarn test
```

## Contributions needed
1. The types could be improved. The parameters for certain functions could be typed with sum types with all the possible combinations of requests Janus allows. They are current typed as "any" in some cases.
