const { describe, it } = require("node:test");
const assert = require("node:assert");

const { handler } = require("./index.js");

// NOTE(venikx): yes it's annoying that we don't have a unit function but meh
const emptyStub = {
  uri: "",
  querystring: {},
  headers: {},
  method: "GET",
};

describe("url rewrites", () => {
  describe("to original image", () => {
    it("empty querystrings", () => {
      const request = {
        uri: "",
        querystring: {},
        headers: {},
        method: "GET",
      };

      const result = { ...emptyStub, uri: "/original" };

      assert.deepEqual(result, handler({ request }));
    });

    it("no valid querystrings", () => {
      const request = {
        uri: "",
        headers: {},
        method: "GET",
        querystring: { hello: { value: "goodbye" } },
      };

      const result = { ...emptyStub, uri: "/original" };

      assert.deepEqual(result, handler({ request }));
    });

    it("valid querystring key, but invalid value", () => {
      const request = {
        uri: "",
        headers: {},
        method: "GET",
        querystring: {
          width: { value: "invalid" },
          heigth: { value: "invalid" },
        },
      };

      const result = { ...emptyStub, uri: "/original" };

      assert.deepEqual(result, handler({ request }));
    });
  });

  describe("with a valid querystring", () => {
    it("transforms querystring into comma separated list", () => {
      const request = {
        uri: "",
        headers: {},
        method: "GET",
        querystring: {
          width: { value: "100" },
          height: { value: "100" },
        },
      };

      const result = { ...emptyStub, uri: "/width=100,height=100" };

      assert.deepEqual(result, handler({ request }));
    });

    it("querystring is stable, even if params are swapped", () => {
      const request = {
        uri: "",
        headers: {},
        method: "GET",
        querystring: {
          height: { value: "100" },
          width: { value: "100" },
        },
      };

      const result = { ...emptyStub, uri: "/width=100,height=100" };

      assert.deepEqual(result, handler({ request }));
    });
  });
});
