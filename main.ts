import { parse } from "https://deno.land/x/xml@2.1.3/mod.ts";

if (import.meta.main) {
  console.log(parse(`
  <root>
    <!-- This is a comment -->
    <text>hello</text>
    <array>world</array>
    <array>monde</array>
    <array>世界</array>
    <array>🌏</array>
    <number>42</number>
    <boolean>true</boolean>
    <complex attribute="value">content</complex>
  </root>
`));
}
