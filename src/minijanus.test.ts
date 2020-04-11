import { JanusSession, JanusPluginHandle } from "./minijanus";

test("events are detected and matched to handles", function (done) {
  var session = new JanusSession((_signal: any) => {}, {
    keepaliveMs: null,
  });
  var handles = [0, 1, 2].map((i) => {
    var h = new JanusPluginHandle(session);
    h.id = i;
    return h;
  });
  var h0 = new Promise((resolve) => handles[0].on("foo", resolve));
  var h1 = new Promise((resolve) => handles[1].on("foo", resolve));
  var h2 = new Promise((resolve) => handles[2].on("bar", resolve));

  session.receive({ janus: "foo", sender: 123 });
  session.receive({ janus: "foo", sender: 0 });
  session.receive({ janus: "bar", sender: 2 });
  session.receive({ janus: "foo", sender: 456 });
  session.receive({ janus: "foo", sender: 1 });

  Promise.all([h0, h1, h2])
    .then((results) => {
      expect(results[0]).toEqual({ janus: "foo", sender: 0 });
      expect(results[1]).toEqual({ janus: "foo", sender: 1 });
      expect(results[2]).toEqual({ janus: "bar", sender: 2 });
      done();
    })
    .catch((err) => {
      done.fail(err);
      done();
    });
});

test("transactions are detected and matched up", function (done) {
  var session = new JanusSession((_signal: any) => {}, {
    keepaliveMs: null,
  });

  var trickle = session.send("trickle", { transaction: "bigs" });
  var aq = session.send("message", { transaction: "figs" });
  var bq = session.send("message", { transaction: "wigs" });
  var cq = session.send("message", { transaction: "pigs" });

  session.receive({ transaction: "???" });
  session.receive({ transaction: "bigs", janus: "ack" });
  session.receive({ transaction: "figs", janus: "ack" });
  session.receive({ transaction: "wigs", janus: "ack" });
  session.receive({
    transaction: "pigs",
    janus: "ack",
    hint: "Asynchronously processing some pigs.",
  });

  session.receive({ transaction: "pigs", rats: "pats" });
  session.receive({ just: "kidding" });
  session.receive({});
  session.receive({ transaction: "figs", cats: "hats" });
  session.receive({ transaction: "wigs" });

  Promise.all([trickle, aq, bq, cq])
    .then((results) => {
      expect(results[0]).toEqual({ transaction: "bigs", janus: "ack" });
      expect(results[1]).toEqual({ transaction: "figs", cats: "hats" });
      expect(results[2]).toEqual({ transaction: "wigs" });
      expect(results[3]).toEqual({ transaction: "pigs", rats: "pats" });
      expect(session.txns).toEqual({});
      done();
    })
    .catch((err) => {
      done.fail(err);
      done();
    });
});

test("transaction timeouts happen", function (done) {
  var session = new JanusSession((_signal: any) => {}, {
    timeoutMs: 5,
    keepaliveMs: null,
  });

  var aq = session.send("message", { transaction: "lazy" }).then(
    (resp) => {
      done.fail("Request should have failed!");
      return resp;
    },
    (err) => {
      return err;
    }
  );
  var bq = session.send("message", { transaction: "hasty" }).then(
    (resp) => {
      return resp;
    },
    (err) => {
      done.fail("Timeout shouldn't have fired!");
      return err;
    }
  );

  session.receive({ transaction: "lazy", janus: "ack" });
  session.receive({ transaction: "hasty", janus: "ack" });

  setTimeout(
    () => session.receive({ transaction: "hasty", phew: "just-in-time" }),
    1
  );

  Promise.all([aq, bq])
    .then((results) => {
      expect(results[1]).toEqual({
        transaction: "hasty",
        phew: "just-in-time",
      });
      expect(session.txns).toEqual({});
      done();
    })
    .catch((err) => {
      done.fail(err);
      done();
    });
});

test("session transactions are properly disposed of", function (done) {
  var session = new JanusSession((_signal: any) => {}, {
    timeoutMs: 5,
    keepaliveMs: null,
  });

  var message1 = session.send("message", { transaction: "message1" }).then(
    (resp) => {
      return resp;
    },
    (err) => {
      done.fail("Message should have been received.");
      return err;
    }
  );
  var message2 = session.send("message", { transaction: "message2" }).then(
    (resp) => {
      done.fail("Message 2 shouldn't have been received.");
      return resp;
    },
    (err) => {
      return err;
    }
  );

  session.receive({ transaction: "message1", value: "test" });

  session.dispose();

  Promise.all([message1, message2])
    .then((results) => {
      expect(results[0]).toEqual({ transaction: "message1", value: "test" });
      expect(session.txns).toEqual({});
      done();
    })
    .catch((err) => {
      done.fail(err);
      done();
    });
});
