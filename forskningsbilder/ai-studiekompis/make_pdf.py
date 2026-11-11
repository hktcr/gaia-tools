from pathlib import Path
import re,base64,json
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from fontTools.ttLib import TTFont as FontToolsFont
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.pens.cu2quPen import Cu2QuPen
from reportlab.lib.colors import HexColor

root=Path(__file__).parent/'version-1'
html=(root/'index.html').read_text()
tmp=Path(__file__).parent/'pdf-assets';tmp.mkdir(exist_ok=True)
blocks=re.findall(r'@font-face\{[^}]+\}',html)
for block in blocks:
 b64=re.search(r'base64,([A-Za-z0-9+/=]+)',block).group(1)
 name='Demi' if '700' in block or 'bold' in block else 'Book'
 original=tmp/(name+'.otf');original.write_bytes(base64.b64decode(b64))
 src=FontToolsFont(original);fb=FontBuilder(src['head'].unitsPerEm,isTTF=True);order=src.getGlyphOrder();fb.setupGlyphOrder(order);fb.setupCharacterMap(src.getBestCmap());gs=src.getGlyphSet();glyphs={}
 for gn in order:
  pen=TTGlyphPen(gs);qpen=Cu2QuPen(pen,max_err=1.0,reverse_direction=True);gs[gn].draw(qpen);glyphs[gn]=pen.glyph()
 fb.setupGlyf(glyphs);fb.setupHorizontalMetrics(src['hmtx'].metrics);fb.setupHorizontalHeader(ascent=src['hhea'].ascent,descent=src['hhea'].descent);fb.setupOS2(sTypoAscender=src['OS/2'].sTypoAscender,sTypoDescender=src['OS/2'].sTypoDescender,usWinAscent=src['OS/2'].usWinAscent,usWinDescent=src['OS/2'].usWinDescent);fb.setupNameTable({'familyName':'URW Gothic','styleName':name,'uniqueFontIdentifier':'URWGothic-'+name,'fullName':'URW Gothic '+name,'psName':'URWGothic-'+name,'version':'Version 1.0'});fb.setupPost();fb.setupMaxp()
 p=tmp/(name+'.ttf');fb.font.recalcTimestamp=False;fb.font['head'].created=3406620153;fb.font['head'].modified=3406620153;fb.save(p);pdfmetrics.registerFont(TTFont(name,str(p)))
assert all(x in pdfmetrics.getRegisteredFontNames() for x in ['Book','Demi'])
W,H=1280,720
paper='#f8f5ed';ink='#193b3a';teal='#246b62';copper='#a14d31';muted='#526763';line='#bcc8bd'
out=root/'AI_som_studiekompis_reserv.pdf'
c=canvas.Canvas(str(out),pagesize=(W,H),invariant=1,pageCompression=1)
c.setTitle('AI som studiekompis · Reserv och källor · 1.0.0');c.setAuthor('Håkan Karlsson · gAIa')
def text(s,x,y,size=18,font='Book',color=ink):
 c.setFont(font,size);c.setFillColor(HexColor(color));c.drawString(x,H-y,s)
def wrap(s,x,y,width,size=17,font='Book',color=ink,leading=None):
 leading=leading or size*1.4
 words=s.split();row=''
 for word in words:
  candidate=(row+' '+word).strip()
  if pdfmetrics.stringWidth(candidate,font,size)>width and row:
   text(row,x,y,size,font,color);y+=leading;row=word
  else:row=candidate
 if row:text(row,x,y,size,font,color);y+=leading
 return y
def rule(x1,y,x2,color=line,dash=False):
 c.setStrokeColor(HexColor(color));c.setLineWidth(.8);c.setDash(4,4) if dash else c.setDash();c.line(x1,H-y,x2,H-y);c.setDash()
def page(n,title=None):
 c.setFillColor(HexColor(paper));c.rect(0,0,W,H,fill=1,stroke=0)
 c.setStrokeColor(HexColor('#e2e7dc'));c.setLineWidth(.7)
 for r in [95,125,155,185,215,245]:c.circle(1200,660,r,fill=0,stroke=1)
 text('FORSKNINGSBILD 01 · AI SOM STUDIEKOMPIS',60,39,12,'Demi',teal)
 text('Version 1.0.0 · 11 november 2026',970,39,11,'Book',muted)
 if title:text(title,60,97,34,'Demi')
 text('Riktat forskningsurval. Ingen metaanalys. Fyra skolstudier och en universitetsstudie.',60,690,10,'Book',muted)
 text(str(n)+' / 4',1172,690,10,'Book',muted)
 c.linkURL('https://hktcr.github.io/gaia-tools/forskningsbilder/ai-studiekompis/',(60,20,870,42),relative=0)

page(1)
text('Vad klarar eleven',60,108,44,'Demi');text('när AI-stödet försvinner?',60,160,44,'Demi')
text('Bättre resultat under övningen är inte samma sak som självständigt lärande.',60,207,23)
rule(60,238,1220)
text('FAS A · AI TILLGÄNGLIG',60,267,12,'Demi',muted)
text('Under övningen',60,301,28,'Demi')
text('FAS B · ALLA UTAN AI',680,267,12,'Demi',muted)
text('På det efterföljande provet',680,301,28,'Demi')
c.setStrokeColor(HexColor(line));c.setDash(4,4);c.line(640,H-251,640,H-507);c.setDash()
for x in [60,680]:
 rule(x,322,x+540);rule(x,404,x+540)
 text('GPT Base',x,354,21,'Demi');text('GPT Tutor',x,436,21,'Demi')
text('Allmän chatthjälp',60,378,14,'Book',muted)
text('Lärarskapade ledtrådar',60,460,14,'Book',muted)
text('+48 %',437,374,43,'Demi',teal);text('+127 %',410,456,43,'Demi',teal)
text('Efter övning med allmän chatthjälp',680,378,13,'Book',muted)
text('Efter övning med utformat stöd',680,460,13,'Book',muted)
text('−17 %',1050,374,43,'Demi',copper)
text('Ingen säkerställd',1013,429,21,'Demi');text('skillnad',1013,455,21,'Demi')
text('Jämfört med kontrollgruppens övningsresultat.',60,493,12,'Book',muted)
text('Jämfört med kontrollgruppens provresultat.',680,493,12,'Book',muted)
rule(60,514,1220)
wrap('Bastani m.fl. (2025). Relativa skillnader mot kontrollgruppen i respektive fas. Två olika uppgifter, inte en poängkurva över tid.',60,540,1155,13,color=muted)
text('ATT TA MED SIG',60,595,11,'Demi',teal)
wrap('Med det utformade stödet påvisades varken sämre eller bättre provresultat än i kontrollgruppen.',60,624,1130,23,'Demi')
c.showPage()
studies=json.loads((root/'studier.json').read_text())
for p in range(3):
 page(p+2,'Studierna bakom bilden' if p<2 else 'Syntes och läsanvisning')
 y=136
 for s in studies[p*2:p*2+2]:
  rule(60,y-5,1220);y+=22
  text(s['short']+' · '+s['setting']+' · '+s['kind'],60,y,20,'Demi',teal);y+=29
  y=wrap(s['who']+' '+s['comparison'],60,y,1145,15,leading=20)
  y=wrap('Resultat: '+s['result'],60,y+5,1145,16,'Demi',leading=21)
  y=wrap('Begränsning: '+s['limit'],60,y+4,1145,14,leading=19)
  y=wrap(s['authors']+' '+s['reference'],60,y+4,1145,11,color=muted,leading=15)
  text(s['url'],60,y,11,'Book',teal);c.linkURL(s['url'],(60,H-y-4,850,H-y+12),relative=0);y+=17
  y=wrap('Lässtatus: '+s['reading'],60,y,1145,10,color=muted,leading=14)+20
 if p==2:
  rule(60,y-4,1220);y+=25;text('Vår syntes',60,y,22,'Demi');y+=31
  y=wrap('Bedöm vad eleven klarar själv, vilket stöd som faktiskt prövades och hur det användes. Goda övningsresultat eller hög uppskattning ersätter inte självständiga lärandemått.',60,y,1120,19,leading=27)
  y+=16;text('Urval och kontroll',60,y,20,'Demi');y+=28
  y=wrap('Fem primärstudier valda för olika elevgrupper, stödformer och utfall. Ingen gemensam effekt har beräknats. Två underlag är arbetsrapporter. Långsiktigt lärande och överförbarhet till svensk grundskola är öppna frågor. Källornas olika lässtatus framgår ovan.',60,y,1120,16,leading=23)
 assert y<665, (p,y)
 c.showPage()
c.save();print(out)
