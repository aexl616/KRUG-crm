const {test}=require('node:test'),assert=require('node:assert/strict');
const {render,validate}=require('../telegram-content');
test('template interpolation is one pass, plain text and rejects unsupported placeholders',()=>{
 assert.equal(render({body:'Привет {client_name}'},{client_name:'{secret}<script>'}).text,'Привет {secret}<script>');
 for(const body of ['{bad}','{client_name','hello }','{{client_name}}'])assert.throws(()=>validate({body}));
 for(const button_url of ['javascript:alert(1)','http://example.org','https://name:password@example.org','https://example.org/{client_name}'])assert.throws(()=>validate({body:'ok',button_target:'url',button_url}));
 assert.equal(render({title:'Тема',body:'Текст',button_target:'url',button_url:'https://example.org/path'}).text,'Тема\n\nТекст');
 assert.throws(()=>render({body:'{client_name}'},{client_name:'a'.repeat(4097)}));
});
test('Telegram HTML is validated and placeholder values cannot become markup',()=>{
 const rendered=render({title:'<b>КРУГ & друзья</b>',body:'Привет, <i>{client_name}</i>. <a href="https://krug.example/path?a=1&b=2">Открыть</a>',button_target:'none'},{client_name:'Аня & <admin>'});
 assert.equal(rendered.parse_mode,'HTML');assert.ok(rendered.text.includes('КРУГ &amp; друзья'));assert.ok(rendered.text.includes('Аня &amp; &lt;admin&gt;'));assert.ok(rendered.text.includes('a=1&amp;b=2'));
 for(const body of ['<script>bad</script>','<b>bad</i>','<a href="http://example.org">bad</a>','<b untrusted="1">bad</b>'])assert.throws(()=>validate({body,button_target:'none'}));
});
