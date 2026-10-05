import json,re,sys,numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold, cross_val_predict
def prep(t):
    t=(t or '').lower()
    t=re.sub(r'https?://\S+|www\.\S+|\b[a-z0-9-]+\.(?:in|com|co|me|ly|net|org)/\S*',' urltok ',t)
    t=re.sub(r'\d+','0',t)
    return re.findall(r'[a-z0-9_]+',t)
def an(t):
    w=prep(t); return w+[a+' '+b for a,b in zip(w,w[1:])]
rows=json.load(open('india.json'))
ev={}
for f in ['random-public-sample.json','random-public-sample-2.json','public-upi-dataset.json']:
    for c in json.load(open('/tmp/r/server/eval/'+f)): ev[(c['text'] or '').strip()]=1
seen=set();tr=[];te=[]
for r in rows:
    t=(r['text'] or '').strip()
    if not t or t in seen: continue
    seen.add(t)
    (te if t in ev else tr).append((t,1 if r['label']=='spam' else 0))
import random
random.seed(20261005)
for line in open('SMSSpamCollection',encoding='utf8',errors='ignore'):
    lab,_,t=line.rstrip('\n').partition('\t'); t=t.strip()
    if not t or t in seen: continue
    seen.add(t)
    (te if random.random()<0.2 else tr).append((t,1 if lab=='spam' else 0))
print('train',len(tr),'heldout-in-dataset',len(te))
X=[t for t,_ in tr];y=np.array([l for _,l in tr])
v=TfidfVectorizer(analyzer=an,min_df=2,norm='l2')
M=v.fit_transform(X)
print('vocab',M.shape)
best=None
for C in [1,3,10,30]:
    p=cross_val_predict(LogisticRegression(C=C,max_iter=2000),M,y,cv=StratifiedKFold(5,shuffle=True,random_state=1),method='predict_proba')[:,1]
    from sklearn.metrics import roc_auc_score
    a=roc_auc_score(y,p);print('C',C,'cv auc',round(a,4))
    if not best or a>best[0]: best=(a,C,p)
a,C,p=best
# threshold: highest recall with CV false-positive rate <=1% on ham
ths=np.linspace(0.3,0.95,66);chosen=None
for th in ths:
    fp=((p>=th)&(y==0)).sum()/ (y==0).sum()
    if fp<=0.01: chosen=th;break
rec=((p>=chosen)&(y==1)).sum()/(y==1).sum()
print('C',C,'threshold',chosen,'cv recall',round(rec,3))
clf=LogisticRegression(C=C,max_iter=2000).fit(M,y)
voc=v.vocabulary_;idf=v.idf_
feats={t:[round(float(idf[i]),4),round(float(clf.coef_[0][i]),4)] for t,i in voc.items()}
json.dump({'source':'anmolshrivastav/scam-ham-india (train split, eval texts excluded)','analyzer':'lowercase, urls->urltok, digit runs->0, [a-z0-9_]+ words plus adjacent bigrams','C':C,'threshold':round(float(chosen),3),'intercept':round(float(clf.intercept_[0]),4),'features':feats},open('india-lr.json','w'),separators=(',',':'))
json.dump([{'text':t,'expect':'scam' if l else 'ham'} for t,l in te],open('india-test.json','w'))
