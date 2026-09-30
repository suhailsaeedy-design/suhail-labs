#!/usr/bin/env python3
from pathlib import Path
from html.parser import HTMLParser
import json,re,subprocess,tempfile,sys,zipfile

ROOT=Path(__file__).resolve().parents[1]
errors=[]

def fail(msg): errors.append(msg)
def read(path):
    p=ROOT/path
    if not p.is_file():
        fail(f"missing file: {path}")
        return ""
    return p.read_text(encoding="utf-8",errors="ignore")

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(); self.refs=[]; self.labels=set(); self.controls=[]; self.label_depth=0; self.ids=[]; self.blank_links=[]; self.images=[]
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if a.get("id"): self.ids.append(a["id"])
        if tag=="a" and str(a.get("target","")).lower()=="_blank": self.blank_links.append(a)
        if tag=="img": self.images.append(a)
        if tag=="label":
            self.label_depth+=1
            if a.get("for"): self.labels.add(a["for"])
        if tag in ("input","select","textarea") and str(a.get("type","")).lower()!="hidden":
            self.controls.append((a,self.label_depth>0))
        key={"a":"href","script":"src","link":"href","img":"src","source":"src"}.get(tag)
        if key and a.get(key): self.refs.append(a[key])
    def handle_endtag(self,tag):
        if tag=="label" and self.label_depth>0: self.label_depth-=1

def local_ref(page,ref):
    if not ref or ref.startswith(("http:","https:","mailto:","tel:","javascript:","#","data:")): return None
    clean=ref.split("?",1)[0].split("#",1)[0]
    return (page.parent/clean).resolve() if clean else None

def check_html(path,project=False):
    p=ROOT/path; text=read(path)
    parser=Parser(); parser.feed(text)
    if 'name="viewport"' not in text: fail(f"{path}: viewport missing")
    dup=sorted({x for x in parser.ids if parser.ids.count(x)>1})
    if dup: fail(f"{path}: duplicate HTML ids {dup}")
    for a in parser.blank_links:
        rel=str(a.get("rel","")).lower()
        if "noopener" not in rel: fail(f"{path}: target=_blank link missing rel=noopener")
    for a in parser.images:
        if "alt" not in a: fail(f"{path}: image missing alt text")
    if "Suhail Saeedi" in text or "Suhail Saeidi" in text: fail(f"{path}: creator surname misspelled")
    for tag in re.findall(r"<button\b[^>]*>",text,re.I):
        if not re.search(r"\btype\s*=",tag,re.I): fail(f"{path}: button missing explicit type")
    if project:
        if 'data-theme="light"' not in text: fail(f"{path}: Light must be the initial theme")
        if 'data-theme="dark"' not in text: fail(f"{path}: Dark theme support missing")
        if 'id="themeToggle"' not in text: fail(f"{path}: theme toggle missing")
        if "../../index.html" not in text: fail(f"{path}: portfolio return link missing")
        if "prefers-reduced-motion" not in text: fail(f"{path}: reduced-motion fallback missing")
    for a,wrapped in parser.controls:
        cid=a.get("id","")
        named=bool(wrapped or a.get("aria-label") or a.get("aria-labelledby") or a.get("title") or (cid and cid in parser.labels))
        if not named: fail(f"{path}: unlabeled control id={cid or '(none)'}")
    for ref in parser.refs:
        target=local_ref(p,ref)
        if target is not None and not target.exists(): fail(f"{path}: missing local reference {ref}")
    for i,code in enumerate(re.findall(r"<script>([\s\S]*?)</script>",text,re.I)):
        with tempfile.NamedTemporaryFile("w",suffix=".js",delete=False,encoding="utf-8") as tmp:
            tmp.write(code); name=tmp.name
        r=subprocess.run(["node","--check",name],capture_output=True,text=True)
        Path(name).unlink(missing_ok=True)
        if r.returncode: fail(f"{path}: inline JS syntax error #{i+1}: {(r.stderr or r.stdout).strip()}")

for page in ["index.html","project.html","links.html","work-with-me.html","admin.html"]:
    check_html(page)
for page in [
    "projects/001-smart-ordering/index.html",
    "projects/002-network-lab/index.html",
    "projects/003-medical-dictionary/index.html",
    "projects/004-network-speed/index.html",
    "projects/005-smart-inventory/index.html",
]:
    check_html(page,project=True)

download_pairs={
    "downloads/001-smart-ordering.zip":"projects/001-smart-ordering/index.html",
    "downloads/002-network-lab.zip":"projects/002-network-lab/index.html",
    "downloads/004-network-speed.zip":"projects/004-network-speed/index.html",
    "downloads/005-smart-inventory.zip":"projects/005-smart-inventory/index.html",
}
for zip_rel,html_rel in download_pairs.items():
    zip_path=ROOT/zip_rel
    html_path=ROOT/html_rel
    if not zip_path.is_file():
        fail(f"{zip_rel}: download ZIP missing")
        continue
    try:
        with zipfile.ZipFile(zip_path) as zf:
            names=zf.namelist()
            if names!=["index.html"]:
                fail(f"{zip_rel}: ZIP must contain exactly index.html, got {names}")
            elif zf.read("index.html")!=html_path.read_bytes():
                fail(f"{zip_rel}: ZIP index.html is stale and does not match {html_rel}")
            bad=zf.testzip()
            if bad:
                fail(f"{zip_rel}: corrupt ZIP entry {bad}")
    except Exception as e:
        fail(f"{zip_rel}: invalid ZIP ({e})")

raw=read("data/site-data.js").strip()
try:
    payload=re.sub(r"^window\.SUHAIL_LABS_DATA\s*=\s*","",raw)
    payload=re.sub(r";\s*$","",payload)
    data=json.loads(payload)
except Exception as e:
    data={}; fail(f"site-data.js parse failed: {e}")

if data.get("profile",{}).get("name")!="Suhail Saeedy": fail("public creator name must be exactly Suhail Saeedy")
for profile in data.get("profile",{}).get("profiles",[]):
    if profile.get("url") and str(profile.get("handle","")).lower().startswith("add "):
        fail(f"Profile {profile.get('name')}: public URL exists but handle is still a placeholder")
projects=data.get("projects",[])
ids=[str(p.get("id","")) for p in projects]
if ids!=["001","002","003","004","005","006"]: fail(f"project IDs/order must be 001–006, got {ids}")
if len(ids)!=len(set(ids)): fail("project IDs must be unique")
def safe_public_url(value,allow_relative=True):
    value=str(value or "").strip()
    if not value: return True
    if re.match(r"(?i)^https://",value): return True
    if re.match(r"(?i)^[a-z][a-z0-9+.-]*:",value): return False
    return allow_relative and not value.startswith("//")

for profile in data.get("profile",{}).get("profiles",[]):
    url=str(profile.get("url","") or "")
    if url and not safe_public_url(url,False):
        fail(f"Profile {profile.get('name')}: public URL must use https://")

for project in projects:
    for required in ("id","title","category","categoryLabel","status","summary","description","focusAreas","highlights","learning","detailsUrl","note"):
        if required not in project: fail(f"Project {project.get('id')}: missing required field {required}")
    for key in ("detailsUrl","live","download","source"):
        ref=str(project.get(key,"") or "")
        if ref and not safe_public_url(ref,True):
            fail(f"Project {project.get('id')}: unsafe {key} URL scheme")
        if ref and not ref.startswith("https://") and not (ROOT/ref.split("?",1)[0].split("#",1)[0]).exists():
            fail(f"Project {project.get('id')}: missing {key} target {ref}")

p1=read("projects/001-smart-ordering/index.html")
for marker in ["function cancelOrder(","function removeOrderLine(","function removeItem(","Current order"]:
    if marker not in p1: fail(f"Project 001 missing required workflow: {marker}")

p3data=next((p for p in projects if str(p.get("id"))=="003"),{})
if any("local study assistant" in str(x).lower() for x in p3data.get("highlights",[])):
    fail("Project 003: public highlights must not imply offline/local AI")

p2=read("projects/002-network-lab/index.html")
if "Simulation metrics" not in p2 or "not readings from your real network" not in p2:
    fail("Project 002 must clearly label generated metrics as simulation data")
if ";draw()}" in p2.split("function setTheme(theme)",1)[-1].split("\n",1)[0]:
    fail("Project 002 theme initialization must not draw before canvas setup")

p1=read("projects/001-smart-ordering/index.html")
for css_marker in [".catalog{padding:18px;min-width:0}",".cats{display:flex;min-width:0;max-width:100%;",".menu{display:grid;min-width:0;max-width:100%;"]:
    if css_marker not in p1: fail(f"Project 001 mobile shrink containment missing: {css_marker}")
print("Project 001 mobile shrink containment: PASS")

p4=read("projects/004-network-speed/index.html")
for banned in ["downlink*.22","Math.max(...downs)","Math.max(...ups)"]:
    if banned in p4: fail(f"Project 004 contains disallowed measurement shortcut: {banned}")
for css_marker in [".metric-card{padding:18px;min-width:0}",".metric-card strong{display:block;overflow-wrap:anywhere;word-break:break-word;",".metrics{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}"]:
    if css_marker not in p4: fail(f"Project 004 mobile result-card shrink containment missing: {css_marker}")
print("Project 004 mobile result-card shrink containment: PASS")

for marker in ["const download=downs.length?median(downs):NaN","const upload=ups.length?median(ups):NaN","fetchWithTimeout","No missing value was invented or estimated","jitter:values.length>1?stdev(values):NaN"]:
    if marker not in p4: fail(f"Project 004 missing measurement-integrity marker: {marker}")

p5=read("projects/005-smart-inventory/index.html")
for marker in ["BarcodeDetector","getUserMedia","localStorage","reportText()","restoreJson"]:
    if marker not in p5: fail(f"Project 005 missing inventory feature marker: {marker}")
if "sample records" not in p5 or "stored only in this browser" not in p5:
    fail("Project 005 must clearly label sample/local inventory data")
for marker in ["data-close-item","$$('[data-close-item]').forEach","addEventListener('pagehide',stopScanner)","visibilitychange"]:
    if marker not in p5: fail(f"Project 005 missing safe dialog/camera lifecycle marker: {marker}")
if re.search(r"(?<!\$)\$\([^\n;]*\)\.forEach\(",p5):
    fail("Project 005 close buttons must use the multi-element selector helper")

site_css=read("assets/css/site.css")
if "prefers-reduced-motion" not in site_css: fail("Suhail Labs main site reduced-motion fallback missing")
site_js=read("assets/js/site.js")
for marker in ["aria-pressed","Close navigation","GitHub is listed in the public Profiles section","$('#mainNav a').forEach","suhailLabsPublicCacheV1","last successful live snapshot"]:
    if marker not in site_js: fail(f"Suhail Labs public UI accessibility/consistency marker missing: {marker}")
if re.search(r"(?<!\$)\$\([^\n;]*\)\.forEach\(",site_js):
    fail("Suhail Labs public UI contains forEach on a single querySelector result")

project_js=read("assets/js/project.js")
for marker in ["suhailLabsPublicCacheV1","last successful live snapshot"]:
    if marker not in project_js: fail(f"Suhail Labs project page live-cache marker missing: {marker}")

for path in ["assets/js/site.js","assets/js/project.js","assets/js/admin.js"]:
    r=subprocess.run(["node","--check",str(ROOT/path)],capture_output=True,text=True)
    if r.returncode: fail(f"{path}: JS syntax failed: {(r.stderr or r.stdout).strip()}")

secret_patterns=[
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b"),
]
for path in ROOT.rglob("*"):
    if not path.is_file() or path.suffix.lower() not in {".html",".js",".css",".json",".md"}: continue
    if ".git" in path.parts: continue
    text=path.read_text(encoding="utf-8",errors="ignore")
    for pat in secret_patterns:
        if pat.search(text): fail(f"possible secret in {path.relative_to(ROOT)}")

if errors:
    print("SUHAIL LABS QA FAIL")
    for e in errors: print("-",e)
    sys.exit(1)

print("SUHAIL LABS QA PASS")
print(f"projects: {len(data.get('projects',[]))}")
print("responsive/light-dark/accessibility/link/JS/measurement checks: PASS")
