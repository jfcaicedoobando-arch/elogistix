import { PDFDocument, PDFName, PDFDict, PDFRawStream, PDFArray, PDFRef, rgb } from 'pdf-lib';
import * as fontkit from 'fontkit';
import { COLORS } from './src/pdf/theme/tokens';

// Compare fully resolved font dictionaries, including font programs, encodings,
// ToUnicode maps, widths and descriptors. Object numbers are not semantic.
function fontKey(value: any, context: any, seen = new Set<string>()): string {
  if (value instanceof PDFRef) {
    if (seen.has(value.toString())) throw new Error('Unexpected cyclic font resource');
    return fontKey(context.lookup(value), context, new Set([...seen, value.toString()]));
  }
  if (value instanceof PDFRawStream) {
    const bytes = value.getContents();
    return `stream:${fontKey(value.dict,context,seen)}:${Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')).join('')}`;
  }
  if (value instanceof PDFDict) return `{${value.entries().map(([k,v])=>[k.toString(),fontKey(v,context,seen)]).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}:${v}`).join(',')}}`;
  if (value instanceof PDFArray) return `[${value.asArray().map(v=>fontKey(v,context,seen)).join(',')}]`;
  return value?.toString() ?? 'null';
}
function deduplicateIdenticalFontResources(doc: PDFDocument) {
  const fonts = new Map<string, any>();
  let refs = 0, replacements = 0;
  for (const page of doc.getPages()) {
    const dict = page.node.Resources()?.lookup(PDFName.of('Font'),PDFDict);
    if (!dict) continue;
    for (const [key,ref] of dict.entries()) {
      refs++;
      const identity = fontKey(ref,doc.context);
      const previous = fonts.get(identity);
      if (previous) { dict.set(key, previous); if (ref !== previous) replacements++; }
      else fonts.set(identity,ref);
    }
  }
  return {pageFontReferences:refs,uniqueSemanticFonts:fonts.size,replacedReferences:replacements};
}
function pruneUnreachable(doc: PDFDocument) {
  const live = new Set<string>();
  const visit = (value: any): void => {
    if (value instanceof PDFRef) {
      if (live.has(value.toString())) return;
      live.add(value.toString()); visit(doc.context.lookup(value)); return;
    }
    if (value instanceof PDFRawStream) { visit(value.dict); return; }
    if (value instanceof PDFDict) { value.values().forEach(visit); return; }
    if (value instanceof PDFArray) value.asArray().forEach(visit);
  };
  Object.values(doc.context.trailerInfo).forEach(visit);
  let deleted = 0;
  for (const [ref] of doc.context.enumerateIndirectObjects()) if (!live.has(ref.toString())) { doc.context.delete(ref); deleted++; }
  return deleted;
}
export async function mergeBatchPdfs(batches: Uint8Array[], regularFont: Uint8Array) {
  if(!Array.isArray(batches)||batches.length===0)throw new Error('At least one PDF batch is required');
  const merged = await PDFDocument.create();
  let pageOffset = 0;
  const offsets: {start:number,count:number}[] = [];
  for (const bytes of batches) {
    const source = await PDFDocument.load(bytes,{updateMetadata:false});
    if(source.getPageCount()===0)throw new Error('Empty PDF batch is not supported');
    if (pageOffset===0) {
      const title=source.getTitle(),author=source.getAuthor(),creator=source.getCreator(),producer=source.getProducer(),subject=source.getSubject(),keywords=source.getKeywords(),date=source.getCreationDate();
      if(title)merged.setTitle(title);if(author)merged.setAuthor(author);if(creator)merged.setCreator(creator);if(producer)merged.setProducer(producer);if(subject)merged.setSubject(subject);if(keywords)merged.setKeywords([keywords]);if(date){merged.setCreationDate(date);merged.setModificationDate(date);}
    }
    const pages=await merged.copyPages(source,source.getPageIndices());
    pages.forEach(p=>merged.addPage(p));
    offsets.push({start:pageOffset,count:pages.length});pageOffset+=pages.length;
  }
  const before=deduplicateIdenticalFontResources(merged);
  merged.registerFontkit(fontkit);
  // Embed the exact existing Inter face once for global pagination. Full-face
  // embedding works with installed fontkit 2.x without a new subset dependency.
  const face=fontkit.create(regularFont);
  const font=await merged.embedFont(regularFont,{subset:false});
  const hex=COLORS.mutedLight.replace('#','');const color=rgb(parseInt(hex.slice(0,2),16)/255,parseInt(hex.slice(2,4),16)/255,parseInt(hex.slice(4,6),16)/255);
  for(const [index,page] of merged.getPages().entries()) {
    const text=`Página ${index+1} de ${pageOffset}`,size=7.5;
    const x=page.getWidth()-36-font.widthOfTextAtSize(text,size);
    const y=page.getHeight()-(page.getHeight()*.945+6.5)-(face.ascent/face.unitsPerEm)*size;
    page.drawText(text,{x,y,size,font,color});
  }
  await merged.flush();
  const deletedUnreachableObjects=pruneUnreachable(merged);
  const bytes=await merged.save({useObjectStreams:false});
  return {bytes,offsets,fontAudit:{...before,deletedUnreachableObjects},pages:pageOffset};
}
