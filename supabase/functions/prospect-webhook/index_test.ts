import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseRequestBody } from "./index.ts";

Deno.test("parseRequestBody parses JSON Elementor payload", () => {
  const raw = JSON.stringify({
    fields: [
      { id: "nome", title: "Nome", value: "João" },
      { id: "whatsapp", title: "WhatsApp", value: "+55 11 91234-5678" },
    ],
    meta: { posted_data: { form_id: "123" } },
  });

  const body = parseRequestBody(raw, "application/json");
  assertEquals(body.fields?.length, 2);
  assertEquals(body.fields?.[0].value, "João");
});


Deno.test("parseRequestBody parses application/x-www-form-urlencoded payload", () => {
  const raw = "nome=Jo%C3%A3o&whatsapp=%2B55%2011%2091234-5678&origem=elementor";
  const body = parseRequestBody(raw, "application/x-www-form-urlencoded; charset=UTF-8");

  assertEquals(body.nome, "João");
  assertEquals(body.whatsapp, "+55 11 91234-5678");
  assertEquals(body.origem, "elementor");
});

Deno.test("parseRequestBody throws on malformed JSON", () => {
  assertThrows(() => parseRequestBody("not json", "application/json"));
});

Deno.test("parseRequestBody treats unknown content-type as JSON", () => {
  const raw = JSON.stringify({ nome: "Maria" });
  const body = parseRequestBody(raw, "text/plain");
  assertEquals(body.nome, "Maria");
});
