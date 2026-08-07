import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseRequestBody, extractFieldData } from "./index.ts";

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

Deno.test("extractFieldData skips known meta fields in form-encoded payload", () => {
  const raw =
    "nome=Jo%C3%A3o&whatsapp=%2B55%2011%2091234-5678&email=joao%40exemplo.com&" +
    "Data=07%2F08%2F2026&Hor%C3%A1rio=22%3A21&URL+da+p%C3%A1gina=https%3A%2F%2Fexemplo.com%2Fcontato&" +
    "Agente+de+usu%C3%A1rio=Mozilla%2F5.0&IP+remoto=127.0.0.1&Desenvolvido+por=Elementor&" +
    "form_id=form123&form_name=Contato&URL%2Bda%2Bp=https%3A%2F%2Fexemplo.com";

  const body = parseRequestBody(raw, "application/x-www-form-urlencoded; charset=UTF-8");
  const fields = extractFieldData(body);

  assertEquals(fields, {
    nome: "João",
    whatsapp: "+55 11 91234-5678",
    email: "joao@exemplo.com",
  });
});

Deno.test("extractFieldData skips known meta fields in flat JSON payload", () => {
  const body = parseRequestBody(
    JSON.stringify({
      nome: "Maria",
      whatsapp: "+55 11 98765-4321",
      "Data": "07/08/2026",
      "Horário": "22:21",
      "URL da página": "https://exemplo.com/contato",
      "Agente de usuário": "Mozilla/5.0",
      "IP remoto": "127.0.0.1",
      "Desenvolvido por": "Elementor",
      form_id: "form123",
      form_name: "Contato",
      "URL+da+p": "https://exemplo.com",
    }),
    "application/json",
  );

  const fields = extractFieldData(body);

  assertEquals(fields, {
    nome: "Maria",
    whatsapp: "+55 11 98765-4321",
  });
});
