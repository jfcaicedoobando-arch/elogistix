/*
 * Elogistix synthetic memory pilot, native Linux keeper.  Build with:
 *   cc -std=c11 -O2 -Wall -Wextra -Werror -pthread keeper.c -o keeper
 * No libsystemd, cgroup access, shell, privilege change or external worker.
 *
 * Reviewed input: systemd-runtime-interfaces-v3.json Library version 3,
 * SHA256 ecf42be8ad6850810efbb73408d16347fdac2891e3562b0e00495030c4615ee8.
 * Candidate contract pending review; no Linux runtime validation is claimed.
 * ProcessGeneration wire is canonical sorted-key JSON, with no pidfd field.
 * Kernel pidfds remain local retained handles. The watchdog authenticates actual
 * MainPID/unit/executable/physical identity before issuing LOAD_PERMIT.
 * References use SHA256 of canonical UTF-8 JSON, decimal strings for wire u64.
 * INITIAL_THREAD and checkpoint references use exact Library v3 formulas.
 * The keeper's own death/reap must be independently evidenced by its owner.
 *
 * Local evidence: fresh /tmp/elogistix-keeper-<run>-s<slot>-XXXXXX/ledger.jsonl,
 * mode 0700 directory / 0600 file, fsync on each hash-chained append.  Retained
 * for collection; not an immutable authority against other processes of the
 * same UID.  The authenticated watchdog's durable ACK is mandatory for loads.
 * No automatic log deletion or persistent executable installation is performed.
 */
#define _GNU_SOURCE
#include <sys/types.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <sys/stat.h>
#include <sys/mman.h>
#include <sys/wait.h>
#include <sys/prctl.h>
#include <sys/syscall.h>
#include <sys/resource.h>
#include <sys/xattr.h>
#include <sys/sysmacros.h>
#include <poll.h>
#include <dirent.h>
#include <fcntl.h>
#include <pthread.h>
#include <signal.h>
#include <time.h>
#include <unistd.h>
#include <errno.h>
#include <inttypes.h>
#include <limits.h>
#include <stdint.h>
#include <stdatomic.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#define PACKET_MAX 16384
#define JSON_NODES 384
#define JSON_STRING 1025
#define RECORD_MAX (PACKET_MAX+4096)
#define MAX_OWNED 7
#define WORK_US UINT64_C(50000000)
#define CLEANUP_US UINT64_C(60000000)
#define LOAD_BYTES (8u * 1024u * 1024u)
#define LOAD_HOLD_US UINT64_C(2000000)
#define RPC_US UINT64_C(1000000)
#define ARRAY_LEN(a) (sizeof(a) / sizeof((a)[0]))
struct sha256 {
    uint32_t h[8];
    uint64_t bytes;
    unsigned used;
    unsigned char b[64];
};
static uint32_t ror(uint32_t x, unsigned n) {
    return (x >> n) | (x << (32 - n));
}
static void sha_block(struct sha256 *s, const unsigned char *p)
{
    static const uint32_t k[64] = {
        0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
        0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
        0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
        0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
        0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
        0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
        0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
        0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    };
    uint32_t w[64], a,b,c,d,e,f,g,h;
    unsigned i;
    for (i=0;i<16;i++) w[i]=((uint32_t)p[4*i]<<24)|((uint32_t)p[4*i+1]<<16)|((uint32_t)p[4*i+2]<<8)|p[4*i+3];
    for (i=16;i<64;i++) w[i]=(ror(w[i-2],17)^ror(w[i-2],19)^(w[i-2]>>10))+w[i-7]+(ror(w[i-15],7)^ror(w[i-15],18)^(w[i-15]>>3))+w[i-16];
    a=s->h[0];
    b=s->h[1];
    c=s->h[2];
    d=s->h[3];
    e=s->h[4];
    f=s->h[5];
    g=s->h[6];
    h=s->h[7];
    for (i=0;i<64;i++) {
        uint32_t t1=h+(ror(e,6)^ror(e,11)^ror(e,25))+((e&f)^((~e)&g))+k[i]+w[i];
        uint32_t t2=(ror(a,2)^ror(a,13)^ror(a,22))+((a&b)^(a&c)^(b&c));
        h=g;
        g=f;
        f=e;
        e=d+t1;
        d=c;
        c=b;
        b=a;
        a=t1+t2;
    }
    s->h[0]+=a;
    s->h[1]+=b;
    s->h[2]+=c;
    s->h[3]+=d;
    s->h[4]+=e;
    s->h[5]+=f;
    s->h[6]+=g;
    s->h[7]+=h;
}
static void sha_init(struct sha256 *s)
{
    static const uint32_t h[8]={
        0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19
    };
    memset(s,0,sizeof(*s));
    memcpy(s->h,h,sizeof(h));
}
static void sha_update(struct sha256 *s, const void *v, size_t n)
{
    const unsigned char *p=v;
    s->bytes+=n;
    while(n) {
        size_t z=64-s->used;
        if(z>n)z=n;
        memcpy(s->b+s->used,p,z);
        s->used+=(unsigned)z;
        p+=z;
        n-=z;
        if(s->used==64){
            sha_block(s,s->b);
            s->used=0;
        }
    }
}
static void sha_finish(struct sha256 *s, char out[65])
{
    uint64_t bits=s->bytes*8;
    unsigned i;
    unsigned char pad[128]={
        0x80
    };
    size_t n=s->used<56?56-s->used:120-s->used;
    sha_update(s,pad,n);
    for(i=0;i<8;i++)pad[i]=(unsigned char)(bits>>(56-8*i));
    sha_update(s,pad,8);
    for(i=0;i<8;i++) {
        snprintf(out+8*i,9,"%08" PRIx32,s->h[i]);
    }
    out[64]=0;
}
static void hash_text(const char *s, char out[65]) {
    struct sha256 h;
    sha_init(&h);
    sha_update(&h,s,strlen(s));
    sha_finish(&h,out);
}
static uint64_t mono_us(void)
{
    struct timespec ts;
    if(clock_gettime(CLOCK_MONOTONIC,&ts))return UINT64_MAX;
    return (uint64_t)ts.tv_sec*UINT64_C(1000000)+(uint64_t)ts.tv_nsec/1000;
}
static int parse_u64(const char *s, uint64_t *out)
{
    uint64_t v=0;
    const unsigned char *p=(const unsigned char *)s;
    if(!*p || (*p=='0' && p[1]))return -1;
    for(;*p;p++){
        if(*p<'0'||*p>'9'||v>(UINT64_MAX-(*p-'0'))/10)return -1;
        v=v*10+(*p-'0');
    }
    *out=v;
    return 0;
}
static int lower_hex(const char *s, size_t n)
{
    size_t i;
    if(strlen(s)!=n)return 0;
    for(i=0;i<n;i++)if(!((s[i]>='0'&&s[i]<='9')||(s[i]>='a'&&s[i]<='f')))return 0;
    return 1;
}
static int deadline_pair_valid(uint64_t t0, uint64_t work, uint64_t cleanup, uint64_t now)
{
    return t0<=UINT64_MAX-CLEANUP_US && work==t0+WORK_US && cleanup==t0+CLEANUP_US && t0<=now && now<work;
}
static int waitpid_consumed(pid_t requested, pid_t returned, int status)
{
    unsigned raw,signal_number;
    if(requested<=0||returned!=requested||status<0||status>65535)return 0;
    raw=(unsigned)status;
    if(WIFEXITED(status))return (raw&255u)==0;
    signal_number=raw&127u;
    return WIFSIGNALED(status)&&(raw&0xff00u)==0&&signal_number>=1&&signal_number<=64;
}
enum json_type {
    J_OBJECT,J_ARRAY,J_STRING,J_UINT,J_NULL,J_BOOL
};
struct json_node {
    enum json_type type;
    unsigned n;
    int children[64];
    char s[JSON_STRING];
    uint64_t u;
};
struct json_doc {
    struct json_node nodes[JSON_NODES];
    unsigned used;
    const unsigned char *p,*end;
    unsigned maxdepth;
};
static void json_space(struct json_doc *d) {
    while(d->p<d->end && (*d->p==' '||*d->p=='\t'||*d->p=='\n'||*d->p=='\r'))d->p++;
}
static int json_hex4(struct json_doc *d, uint32_t *u)
{
    unsigned i;
    *u=0;
    for(i=0;i<4;i++){
        unsigned c;
        if(d->p==d->end)return -1;
        c=*d->p++;
        if(c>='0'&&c<='9')c-='0';
        else if(c>='a'&&c<='f')c=c-'a'+10;
        else if(c>='A'&&c<='F')c=c-'A'+10;
        else return -1;
        *u=(*u<<4)|c;
    }
    return 0;
}
static int string_byte(char *s,size_t *n,unsigned c) {
    if(*n>=JSON_STRING-1||c==0)return -1;
    s[(*n)++]=(char)c;
    return 0;
}
static int json_string(struct json_doc *d,char *s)
{
    size_t n=0;
    if(d->p==d->end||*d->p++!='"')return -1;
    while(d->p<d->end){
        unsigned c=*d->p++;
        if(c=='"'){
            s[n]=0;
            return 0;
        }
        if(c<32)return -1;
        if(c=='\\'){
            uint32_t u;
            if(d->p==d->end)return -1;
            c=*d->p++;
            if(c=='u'){
                if(json_hex4(d,&u))return -1;
                if(u>=0xd800&&u<=0xdbff){
                    uint32_t lo;
                    if(d->end-d->p<2||d->p[0]!='\\'||d->p[1]!='u')return -1;
                    d->p+=2;
                    if(json_hex4(d,&lo)||lo<0xdc00||lo>0xdfff)return -1;
                    u=0x10000+((u-0xd800)<<10)+(lo-0xdc00);
                }
                else if(u>=0xdc00&&u<=0xdfff)return -1;
                if(u<0x80){
                    if(string_byte(s,&n,u))return -1;
                }
                else if(u<0x800){
                    if(string_byte(s,&n,0xc0|(u>>6))||string_byte(s,&n,0x80|(u&63)))return -1;
                }
                else if(u<0x10000){
                    if(string_byte(s,&n,0xe0|(u>>12))||string_byte(s,&n,0x80|((u>>6)&63))||string_byte(s,&n,0x80|(u&63)))return -1;
                }
                else{
                    if(string_byte(s,&n,0xf0|(u>>18))||string_byte(s,&n,0x80|((u>>12)&63))||string_byte(s,&n,0x80|((u>>6)&63))||string_byte(s,&n,0x80|(u&63)))return -1;
                }
                continue;
            }
            if(c=='b')c='\b';
            else if(c=='f')c='\f';
            else if(c=='n')c='\n';
            else if(c=='r')c='\r';
            else if(c=='t')c='\t';
            else if(c!='"'&&c!='\\'&&c!='/')return -1;
        }
        if(string_byte(s,&n,c))return -1;
    }
    return -1;
}
static int utf8_valid(const unsigned char *p,size_t n)
{
    size_t i=0;
    while(i<n){
        unsigned c=p[i++],count;
        uint32_t u,min;
        if(c<0x80)continue;
        if(c>=0xc2&&c<=0xdf){
            count=1;
            u=c&31;
            min=0x80;
        }
        else if(c>=0xe0&&c<=0xef){
            count=2;
            u=c&15;
            min=0x800;
        }
        else if(c>=0xf0&&c<=0xf4){
            count=3;
            u=c&7;
            min=0x10000;
        }
        else return 0;
        if(n-i<count)return 0;
        while(count--){
            c=p[i++];
            if((c&0xc0)!=0x80)return 0;
            u=(u<<6)|(c&63);
        }
        if(u<min||u>0x10ffff||(u>=0xd800&&u<=0xdfff))return 0;
    }
    return 1;
}
static int json_value(struct json_doc *d,unsigned depth)
{
    int id;
    struct json_node *v;
    unsigned char c;
    json_space(d);
    if(d->p==d->end||d->used==JSON_NODES)return -1;
    /* Root is level 1; contained values (including keys/scalars) count a level.
     * This deliberately matches the shared protocol boundary fixtures. */
    if(depth>d->maxdepth)return -1;
    id=(int)d->used++;
    v=&d->nodes[id];
    memset(v,0,sizeof(*v));
    c=*d->p;
    if(c=='{'||c=='['){
        unsigned end=c=='{'?'}':']';
        v->type=c=='{'?J_OBJECT:J_ARRAY;
        d->p++;
        json_space(d);
        if(d->p<d->end&&*d->p==end){
            d->p++;
            return id;
        }
        for(;;){
            int key=-1,val;
            unsigned i;
            if(v->n==(v->type==J_OBJECT?64u:32u))return -1;
            if(v->type==J_OBJECT){
                key=json_value(d,depth+1);
                if(key<0||d->nodes[key].type!=J_STRING)return -1;
                for(i=0;i<v->n;i+=2)if(!strcmp(d->nodes[v->children[i]].s,d->nodes[key].s))return -1;
                json_space(d);
                if(d->p==d->end||*d->p++!=':')return -1;
            }
            val=json_value(d,depth+1);
            if(val<0)return -1;
            if(key>=0)v->children[v->n++]=key;
            v->children[v->n++]=val;
            json_space(d);
            if(d->p==d->end)return -1;
            c=*d->p++;
            if(c==end)return id;
            if(c!=',')return -1;
        }
    }
    if(c=='"'){
        v->type=J_STRING;
        return json_string(d,v->s)?-1:id;
    }
    if(c>='0'&&c<='9'){
        size_t n=0;
        v->type=J_UINT;
        while(d->p<d->end&&*d->p>='0'&&*d->p<='9'){
            if(n>=20)return -1;
            v->s[n++]=(char)*d->p++;
        }
        v->s[n]=0;
        return parse_u64(v->s,&v->u)?-1:id;
    }
    if(d->end-d->p>=4&&!memcmp(d->p,"null",4)){
        v->type=J_NULL;
        d->p+=4;
        return id;
    }
    if(d->end-d->p>=4&&!memcmp(d->p,"true",4)){
        v->type=J_BOOL;
        v->u=1;
        d->p+=4;
        return id;
    }
    if(d->end-d->p>=5&&!memcmp(d->p,"false",5)){
        v->type=J_BOOL;
        d->p+=5;
        return id;
    }
    return -1;
}
static int json_parse_limit(const char *data,size_t length,struct json_doc *d,unsigned maxdepth,size_t maxbytes)
{
    int root;
    if(!length||length>maxbytes||!utf8_valid((const unsigned char *)data,length))return -1;
    memset(d,0,sizeof(*d));
    d->maxdepth=maxdepth;
    d->p=(const unsigned char *)data;
    d->end=d->p+length;
    root=json_value(d,1);
    json_space(d);
    return root==0&&d->p==d->end&&d->nodes[0].type==J_OBJECT?0:-1;
}
static int json_parse(const char *data,size_t length,struct json_doc *d)
{
    return json_parse_limit(data,length,d,6,PACKET_MAX);
}
struct json_writer {
    char *data;
    size_t used,capacity;
};
static int json_write(struct json_writer *w,const char *s,size_t n)
{
    if(n>=w->capacity-w->used)return -1;
    memcpy(w->data+w->used,s,n);
    w->used+=n;
    w->data[w->used]=0;
    return 0;
}
static int canonical_string(struct json_writer *w,const char *s)
{
    const unsigned char *p=(const unsigned char *)s;
    if(json_write(w,"\"",1))return -1;
    for(;*p;p++){
        char escaped[7];
        const char *simple=NULL;
        if(*p=='"')simple="\\\"";
        else if(*p=='\\')simple="\\\\";
        else if(*p=='\b')simple="\\b";
        else if(*p=='\f')simple="\\f";
        else if(*p=='\n')simple="\\n";
        else if(*p=='\r')simple="\\r";
        else if(*p=='\t')simple="\\t";
        if(simple){
            if(json_write(w,simple,2))return -1;
        }
        else if(*p<32){
            snprintf(escaped,sizeof(escaped),"\\u%04x",*p);
            if(json_write(w,escaped,6))return -1;
        }
        else if(json_write(w,(const char *)p,1))return -1;
    }
    return json_write(w,"\"",1);
}
static int canonical_node(struct json_doc *d,int id,struct json_writer *w)
{
    struct json_node *v=&d->nodes[id];
    unsigned i;
    if(v->type==J_OBJECT){
        unsigned order[32],count=v->n/2;
        for(i=0;i<count;i++){
            unsigned j=i;
            order[i]=i;
            while(j&&strcmp(d->nodes[v->children[2*order[j-1]]].s,d->nodes[v->children[2*order[j]]].s)>0){
                unsigned t=order[j];
                order[j]=order[j-1];
                order[j-1]=t;
                j--;
            }
        }
        if(json_write(w,"{",1))return -1;
        for(i=0;i<count;i++){
            unsigned key=2*order[i];
            if((i&&json_write(w,",",1))||canonical_string(w,d->nodes[v->children[key]].s)||json_write(w,":",1)||canonical_node(d,v->children[key+1],w))return -1;
        }
        return json_write(w,"}",1);
    }
    if(v->type==J_ARRAY){
        if(json_write(w,"[",1))return -1;
        for(i=0;i<v->n;i++)if((i&&json_write(w,",",1))||canonical_node(d,v->children[i],w))return -1;
        return json_write(w,"]",1);
    }
    if(v->type==J_STRING)return canonical_string(w,v->s);
    if(v->type==J_UINT)return json_write(w,v->s,strlen(v->s));
    if(v->type==J_NULL)return json_write(w,"null",4);
    return json_write(w,v->u?"true":"false",v->u?4:5);
}
static int canonical_json(const char *input,char *output,size_t capacity)
{
    struct json_doc d;
    struct json_writer w={
        output,0,capacity
    };
    /* Local evidence may wrap a wire packet; this does not relax wire depth. */
    if(!capacity||json_parse_limit(input,strlen(input),&d,12,RECORD_MAX))return -1;
    return canonical_node(&d,0,&w);
}
static int canonical_digest(const char *input,char ref[65])
{
    char canonical[RECORD_MAX+1];
    if(canonical_json(input,canonical,sizeof(canonical)))return -1;
    hash_text(canonical,ref);
    return 0;
}
static struct json_node *json_get(struct json_doc *d,int object,const char *key)
{
    struct json_node *v=&d->nodes[object];
    unsigned i;
    if(v->type!=J_OBJECT)return NULL;
    for(i=0;i<v->n;i+=2)if(!strcmp(d->nodes[v->children[i]].s,key))return &d->nodes[v->children[i+1]];
    return NULL;
}
static int fields_exact(struct json_doc *d,int object,const char *const *names,size_t n)
{
    size_t i;
    if(d->nodes[object].type!=J_OBJECT||d->nodes[object].n!=2*n)return 0;
    for(i=0;i<n;i++)if(!json_get(d,object,names[i]))return 0;
    return 1;
}
static int node_string(struct json_node *n,const char *s) {
    return n&&n->type==J_STRING&&!strcmp(n->s,s);
}
static int node_u64(struct json_node *n,uint64_t *u) {
    return n&&n->type==J_STRING&&!parse_u64(n->s,u);
}
static int node_ref(struct json_node *n) {
    return n&&n->type==J_STRING&&lower_hex(n->s,64);
}
enum inbound_kind {
    IN_PERMIT,IN_ACK,IN_QUIESCE
};
struct inbound {
    enum inbound_kind kind;
    uint64_t seq,accepted,work,cleanup,mono;
    char hash[65],unit[65],physical[65],scenario[40],reason[65];
};
static int validate_envelope(struct json_doc *d,const char *run,unsigned slot,uint64_t next_seq,struct inbound *out)
{
    static const char *const env[]={
        "v","run","sender","seq","slot","event","request","mono_us","body"
    };
    static const char *const permit[]={
        "unit_binding_ref","physical_binding_ref","scenario","work_deadline_us","cleanup_deadline_us"
    };
    static const char *const ack[]={
        "accepted_seq","ledger_record_sha256"
    };
    static const char *const quiesce[]={
        "reason","cleanup_deadline_us"
    };
    struct json_node *n,*body,*ev,*request;
    int b;
    uint64_t u;
    size_t i;
    memset(out,0,sizeof(*out));
    if(!fields_exact(d,0,env,ARRAY_LEN(env)))return -1;
    n=json_get(d,0,"v");
    if(!n||n->type!=J_UINT||n->u!=3)return -1;
    if(!node_string(json_get(d,0,"run"),run)||!node_string(json_get(d,0,"sender"),"WATCHDOG"))return -1;
    n=json_get(d,0,"seq");
    if(!n||n->type!=J_UINT||n->u!=next_seq||!n->u)return -1;
    out->seq=n->u;
    n=json_get(d,0,"slot");
    if(!n||!((n->type==J_UINT&&n->u==slot)||(n->type==J_NULL&&node_string(json_get(d,0,"event"),"ACK"))))return -1;
    request=json_get(d,0,"request");
    if(!request||(request->type!=J_NULL&&(request->type!=J_UINT||!request->u)))return -1;
    if(!node_u64(json_get(d,0,"mono_us"),&out->mono))return -1;
    body=json_get(d,0,"body");
    if(!body||body->type!=J_OBJECT)return -1;
    b=(int)(body-d->nodes);
    ev=json_get(d,0,"event");
    if(node_string(ev,"LOAD_PERMIT")){
        out->kind=IN_PERMIT;
        if(!fields_exact(d,b,permit,ARRAY_LEN(permit)))return -1;
        n=json_get(d,b,"unit_binding_ref");
        if(!node_ref(n))return -1;
        strcpy(out->unit,n->s);
        n=json_get(d,b,"physical_binding_ref");
        if(!node_ref(n))return -1;
        strcpy(out->physical,n->s);
        n=json_get(d,b,"scenario");
        if(!node_string(n,"OVERLAP")&&!node_string(n,"LEADER_EXIT_THREAD_SURVIVES")&&!node_string(n,"DESCENDANT_IGNORES_TERM"))return -1;
        strcpy(out->scenario,n->s);
        if(!node_u64(json_get(d,b,"work_deadline_us"),&out->work)||!node_u64(json_get(d,b,"cleanup_deadline_us"),&out->cleanup))return -1;
    }
    else if(node_string(ev,"ACK")){
        out->kind=IN_ACK;
        if(!fields_exact(d,b,ack,ARRAY_LEN(ack)))return -1;
        n=json_get(d,b,"accepted_seq");
        if(!n||n->type!=J_UINT||!n->u)return -1;
        out->accepted=n->u;
        if(request->type!=J_UINT||request->u!=out->accepted)return -1;
        n=json_get(d,b,"ledger_record_sha256");
        if(!node_ref(n))return -1;
        strcpy(out->hash,n->s);
    }
    else if(node_string(ev,"QUIESCE")){
        out->kind=IN_QUIESCE;
        if(!fields_exact(d,b,quiesce,ARRAY_LEN(quiesce)))return -1;
        n=json_get(d,b,"reason");
        if(!n||n->type!=J_STRING||!*n->s||strlen(n->s)>64)return -1;
        /* v3 leaves reason's enum unspecified. It is annotation only; every
         * authenticated QUIESCE unconditionally forbids further load. */
        for(i=0;n->s[i];i++)if(!((n->s[i]>='A'&&n->s[i]<='Z')||n->s[i]=='_'))return -1;
        strcpy(out->reason,n->s);
        if(!node_u64(json_get(d,b,"cleanup_deadline_us"),&u))return -1;
        out->cleanup=u;
    }
    else return -1;
    return 0;
}
struct generation {
    pid_t pid;
    uint64_t ticks;
    int pidfd;
    char boot[40],pidns[80],mntns[80],json[600],ref[65];
};
struct owned {
    struct generation gen;
    char spawn[65];
    char spawn_body_ref[65],reap_receipt_ref[65];
    uint64_t seq;
    int gate,report,done,descendant;
    pid_t creator;
    pid_t survivor_tid;
    uint64_t survivor_ticks;
    int leader_observed,load_ready,term_sent,term_verified,expected_signal;
    uint64_t term_at,ready_at;
    char initial_thread_ref[65],thread_ref[65],thread_creation_ref[65];
    pid_t creating_tid;
    uint64_t create_before,create_after,thread_seq;
    int creation_seen,initial_thread_recorded;
};
struct sent {
    uint64_t seq;
    int acked;
    char ack_ref[65];
    char local_record_ref[65],body_ref[65],event[32];
};
struct keeper {
    char run[33],ipc[sizeof(((struct sockaddr_un *)0)->sun_path)],exe[PATH_MAX],scenario[40];
    unsigned slot;
    uint64_t t0,work,cleanup,inseq,outseq,ledgerseq;
    pid_t watchdog_pid;
    uint64_t watchdog_ticks;
    struct generation self,watchdog;
    struct ucred peer;
    int channel,ledger,exe_fd,listener_parent;
    char ledger_path[PATH_MAX],chain[65],spawn_head[65],reap_head[65],unit_ref[65],physical_ref[65];
    struct owned owned[MAX_OWNED];
    unsigned nowned;
    struct sent sent[32];
    unsigned nsent;
    int permit,quiesce,failed,channel_dead,initial_thread_recorded;
    uint64_t kill_after;
    int signalled,overlap_verified;
    char at_event[32];
};
static uint64_t send_event(struct keeper *k,const char *event,const char *body);
static int seq_acked(struct keeper *k,uint64_t seq);
static int reap_owned(struct keeper *k);
static int initial_thread_codec_ready(void)
{
    /* Exact formula and body-only creation antecedent supplied in Library v3. */
    return 1;
}
static int initial_thread_token(const struct generation *owner,char token[65])
{
    char candidate[800];
    int n;
    /* Full original kernel generation, no pidfd, wrapper, timestamp or newline. */
    n=snprintf(candidate,sizeof(candidate),"{\"generation\":%s,\"role\":\"INITIAL_THREAD\"}",owner->json);
    return n<0||(size_t)n>=sizeof(candidate)?-1:canonical_digest(candidate,token);
}
static int format_generation(struct generation *g)
{
    char number[40];
    struct json_writer w={
        g->json,0,sizeof(g->json)
    };
    int n;
    if(g->pid<=0||!g->ticks||strlen(g->boot)!=36)return -1;
    if(json_write(&w,"{\"boot_id\":",11)||canonical_string(&w,g->boot)||json_write(&w,",\"mount_namespace_ref\":",23)||canonical_string(&w,g->mntns))return -1;
    n=snprintf(number,sizeof(number),",\"pid\":%ld",(long)g->pid);
    if(n<0||(size_t)n>=sizeof(number)||json_write(&w,number,(size_t)n))return -1;
    if(json_write(&w,",\"pid_namespace_ref\":",21)||canonical_string(&w,g->pidns))return -1;
    n=snprintf(number,sizeof(number),",\"start_ticks\":\"%" PRIu64 "\"}",g->ticks);
    if(n<0||(size_t)n>=sizeof(number)||json_write(&w,number,(size_t)n))return -1;
    hash_text(g->json,g->ref);
    return 0;
}
static int format_waitpid_receipt(const struct generation *child,const struct generation *reaper,pid_t requested,pid_t returned,int status,uint64_t before,uint64_t after,char *out,size_t capacity)
{
    int n;
    if(!waitpid_consumed(requested,returned,status)||requested!=child->pid||child->pid==reaper->pid||before>after||strcmp(child->boot,reaper->boot)||strcmp(child->pidns,reaper->pidns))return -1;
    n=snprintf(out,capacity,"{\"after_us\":\"%" PRIu64 "\",\"before_us\":\"%" PRIu64 "\",\"child_generation\":%s,\"options\":\"WNOHANG\",\"raw_wait_status\":%u,\"reaper_generation\":%s,\"requested_pid\":%ld,\"returned_pid\":%ld,\"tag\":\"WAITPID_CONSUMED\"}",after,before,child->json,(unsigned)status,reaper->json,(long)requested,(long)returned);
    return n<0||(size_t)n>=capacity?-1:0;
}
static int checkpoint_digest_refs(const char *kind,const char *const *refs,size_t count,char out[65])
{
    const char *sorted[MAX_OWNED];
    char record[600];
    struct json_writer w={record,0,sizeof(record)};
    size_t i,j;
    if((strcmp(kind,"spawns")&&strcmp(kind,"reaps"))||count>MAX_OWNED)return -1;
    for(i=0;i<count;i++){
        if(!lower_hex(refs[i],64))return -1;
        sorted[i]=refs[i];
    }
    for(i=1;i<count;i++){
        const char *ref=sorted[i];
        j=i;
        while(j&&strcmp(sorted[j-1],ref)>0){sorted[j]=sorted[j-1];j--;}
        sorted[j]=ref;
    }
    if(json_write(&w,"{",1)||canonical_string(&w,kind)||json_write(&w,":[",2))return -1;
    for(i=0;i<count;i++){
        if((i&&json_write(&w,",",1))||canonical_string(&w,sorted[i]))return -1;
    }
    if(json_write(&w,"]}",2))return -1;
    return canonical_digest(record,out);
}
static int checkpoint_refs(struct keeper *k)
{
    const char *spawns[MAX_OWNED],*reaps[MAX_OWNED];
    unsigned i;
    for(i=0;i<k->nowned;i++){
        if(!k->owned[i].done||!seq_acked(k,k->owned[i].seq))return -1;
        spawns[i]=k->owned[i].spawn_body_ref;
        reaps[i]=k->owned[i].reap_receipt_ref;
    }
    return checkpoint_digest_refs("spawns",spawns,k->nowned,k->spawn_head)||checkpoint_digest_refs("reaps",reaps,k->nowned,k->reap_head)?-1:0;
}
static volatile sig_atomic_t stop_signal;
static void on_signal(int sig) {
    stop_signal=sig;
}
static int read_text(const char *path,char *out,size_t cap)
{
    int fd=open(path,O_RDONLY|O_CLOEXEC|O_NOFOLLOW);
    ssize_t n;
    if(fd<0)return -1;
    n=read(fd,out,cap-1);
    close(fd);
    if(n<=0||(size_t)n==cap-1)return -1;
    out[n]=0;
    while(n>0&&(out[n-1]=='\n'||out[n-1]=='\r'))out[--n]=0;
    return 0;
}
static int proc_stat(pid_t pid,pid_t tid,uint64_t *ticks,char *state,pid_t *parent)
{
    char path[100],buf[4096],*p,*end;
    unsigned field;
    if(tid)snprintf(path,sizeof(path),"/proc/%ld/task/%ld/stat",(long)pid,(long)tid);
    else snprintf(path,sizeof(path),"/proc/%ld/stat",(long)pid);
    if(read_text(path,buf,sizeof(buf)))return -1;
    p=strrchr(buf,')');
    if(!p||p[1]!=' '||!p[2]||p[3]!=' ')return -1;
    *state=p[2];
    p+=4;
    for(field=4;field<=22;field++) {
        unsigned long long v;
        errno=0;
        v=strtoull(p,&end,10);
        if(errno||end==p)return -1;
        if(field==4)*parent=(pid_t)v;
        if(field==22)*ticks=(uint64_t)v;
        p=end;
        if(field<22){
            if(*p!=' ')return -1;
            p++;
        }
    }
    return 0;
}
static int namespace_ref(pid_t pid,const char *which,char *out,size_t cap)
{
    char path[100];
    ssize_t n;
    snprintf(path,sizeof(path),"/proc/%ld/ns/%s",(long)pid,which);
    n=readlink(path,out,cap-1);
    if(n<=0||(size_t)n>=cap-1)return -1;
    out[n]=0;
    return 0;
}
static int thread_owner_is(pid_t tid,pid_t owner)
{
    char path[80],status[4096],*line;
    long tgid=0;
    snprintf(path,sizeof(path),"/proc/%ld/status",(long)tid);
    if(read_text(path,status,sizeof(status)))return 0;
    for(line=strtok(status,"\n");line;line=strtok(NULL,"\n")){
        if(!strncmp(line,"Tgid:",5))return sscanf(line+5,"%ld",&tgid)==1&&tgid==(long)owner;
    }
    return 0;
}
static int local_pidfd(pid_t pid)
{
#ifdef SYS_pidfd_open
    return (int)syscall(SYS_pidfd_open,pid,0);
#else
    (void)pid;
    errno=ENOSYS;
    return -1;
#endif
}
static int generation_read(pid_t pid,struct generation *g)
{
    char state;
    pid_t parent;
    struct pollfd p;
    uint64_t after;
    char again;
    memset(g,0,sizeof(*g));
    g->pid=pid;
    g->pidfd=-1;
    if(proc_stat(pid,0,&g->ticks,&state,&parent)||read_text("/proc/sys/kernel/random/boot_id",g->boot,sizeof(g->boot))||strlen(g->boot)!=36||namespace_ref(pid,"pid",g->pidns,sizeof(g->pidns))||namespace_ref(pid,"mnt",g->mntns,sizeof(g->mntns)))return -1;
    g->pidfd=local_pidfd(pid);
    if(g->pidfd<0)return -1;
    p.fd=g->pidfd;
    p.events=POLLIN;
    p.revents=0;
    if(poll(&p,1,0)<0||p.revents||proc_stat(pid,0,&after,&again,&parent)||after!=g->ticks){
        close(g->pidfd);
        g->pidfd=-1;
        return -1;
    }
    return format_generation(g);
}
static int watchdog_live(struct keeper *k)
{
    struct pollfd p={
        .fd=k->watchdog.pidfd,.events=POLLIN
    };
    uint64_t ticks;
    char state,pidns[80],mntns[80];
    pid_t parent;
    return poll(&p,1,0)==0&&!p.revents&&!proc_stat(k->watchdog.pid,0,&ticks,&state,&parent)&&ticks==k->watchdog.ticks&&!namespace_ref(k->watchdog.pid,"pid",pidns,sizeof(pidns))&&!namespace_ref(k->watchdog.pid,"mnt",mntns,sizeof(mntns))&&!strcmp(pidns,k->watchdog.pidns)&&!strcmp(mntns,k->watchdog.mntns);
}
static int write_all(int fd,const char *p,size_t n)
{
    while(n){
        ssize_t z=write(fd,p,n);
        if(z<0&&errno==EINTR)continue;
        if(z<=0)return -1;
        p+=z;
        n-=(size_t)z;
    }
    return 0;
}
static int ledger_record(struct keeper *k,const char *kind,const char *detail,char ref[65])
{
    char core[RECORD_MAX+1],canonical[RECORD_MAX+1],line[RECORD_MAX+128];
    int n;
    n=snprintf(core,sizeof(core),"{\"facts\":%s,\"kind\":\"%s\",\"mono_us\":\"%" PRIu64 "\",\"previous\":\"%s\",\"slot\":%u}",detail,kind,mono_us(),k->chain,k->slot);
    if(n<0||(size_t)n>=sizeof(core))return -1;
    if(canonical_json(core,canonical,sizeof(canonical)))return -1;
    hash_text(canonical,ref);
    n=snprintf(line,sizeof(line),"{\"record\":%s,\"ref\":\"%s\"}\n",canonical,ref);
    if(n<0||(size_t)n>=sizeof(line)||write_all(k->ledger,line,(size_t)n)||fsync(k->ledger))return -1;
    strcpy(k->chain,ref);
    return 0;
}
static int record_initial_thread(struct keeper *k,const struct generation *owner,const char *creation_ref,char token[65])
{
    char detail[450],ref[65];
    int n;
    if(!lower_hex(creation_ref,64)||initial_thread_token(owner,token))return -1;
    n=snprintf(detail,sizeof(detail),"{\"creation_ref\":\"%s\",\"label\":\"INITIAL_THREAD\",\"owner_process_generation_ref\":\"%s\",\"thread_ref\":\"%s\"}",creation_ref,owner->ref,token);
    return n<0||(size_t)n>=sizeof(detail)?-1:ledger_record(k,"INITIAL_THREAD_REGISTERED",detail,ref);
}
static void failure(struct keeper *k,const char *code)
{
    char detail[160],ref[65];
    int saved=errno;
    const char *fault="INTERNAL",*missing="[]";
    char body[400];
    if(k->failed){
        k->quiesce=1;
        return;
    }
    k->failed=1;
    k->quiesce=1;
    snprintf(detail,sizeof(detail),"{\"reason\":\"%s\",\"errno\":%d}",code,saved);
    if(k->ledger>=0&&ledger_record(k,"LOCAL_FAILURE",detail,ref))fprintf(stderr,"keeper: ledger append failed\n");
    fprintf(stderr,"keeper: %s (errno=%d); incomplete\n",code,saved);
    if(strstr(code,"DEADLINE")||strstr(code,"LATE")){
        fault="DEADLINE";
        missing="[\"DEADLINE\"]";
    }
    else if(!strcmp(code,"WATCHDOG_DEATH"))fault="WATCHDOG_DIED";
    else if(strstr(code,"CHANNEL_LOST"))fault="PEER_CLOSED";
    else if(strstr(code,"DELIVERY"))fault="TRANSPORT_UNKNOWN";
    else if(strstr(code,"PROTOCOL"))fault="PROTOCOL";
    else if(strstr(code,"IDENTITY")||strstr(code,"CREDENTIAL"))fault="IDENTITY_CHANGED";
    else if(strstr(code,"THREAD_CODEC_PENDING")){
        fault="REAP_POLICY_PENDING";
        missing="[\"REAP_LEDGER\"]";
    }
    else if(strstr(code,"REAP")||strstr(code,"UNREGISTERED")||strstr(code,"WAIT_")||strstr(code,"AUTHENTIC_SPAWN")){
        fault="REAP_UNKNOWN";
        missing="[\"REAP_LEDGER\"]";
    }
    /* V3 lists exact enums and fields. Scalar types of at_event/identity_ref
     * remain absent from the exported JSON: this uses event string + SHA256
     * identity string, awaiting the central validator's scalar confirmation. */
    if(k->channel>=0&&!k->channel_dead&&k->ledger>=0&&lower_hex(k->self.ref,64)&&watchdog_live(k)){
        snprintf(body,sizeof(body),"{\"code\":\"%s\",\"at_event\":\"%s\",\"identity_ref\":\"%s\",\"missing_evidence\":%s}",fault,*k->at_event?k->at_event:"KEEPER_HELLO",k->self.ref,missing);
        if(!send_event(k,"FAULT",body))fprintf(stderr,"keeper: FAULT delivery unavailable\n");
    }
}
static int stdio_safe(int fd)
{
    struct stat st;
    if(fstat(fd,&st))return errno==EBADF;
    if(S_ISFIFO(st.st_mode))return 1;
    if(S_ISCHR(st.st_mode))return (major(st.st_rdev)==1&&minor(st.st_rdev)==3)||(isatty(fd)&&st.st_uid==getuid());
    if(fd>0&&S_ISSOCK(st.st_mode)){
        struct sockaddr_storage address;
        socklen_t length=sizeof(address),type_length=sizeof(int);
        int type=0;
        return !getsockname(fd,(struct sockaddr *)&address,&length)&&address.ss_family==AF_UNIX&&!getsockopt(fd,SOL_SOCKET,SO_TYPE,&type,&type_length)&&type==SOCK_STREAM;
    }
    /* Launcher stdio is null/ordinary tty, pipe, or Unix stream log output.
     * Regular files, directories, devices and control SEQPACKET endpoints do
     * not become permissible merely by occupying descriptors 0, 1 or 2. */
    return 0;
}
static int inherited_fds_clean(void)
{
    DIR *d=opendir("/proc/self/fd");
    struct dirent *e;
    int result=0,own,i;
    for(i=0;i<=2;i++)if(!stdio_safe(i)){
        fprintf(stderr,"keeper: unsafe inherited stdio descriptor %d; no load\n",i);
        result=-1;
    }
    if(!d)return -1;
    own=dirfd(d);
    while((e=readdir(d))){
        char *end;
        long fd=strtol(e->d_name,&end,10);
        if(*e->d_name&&!*end&&fd>2&&fd!=own){
            fprintf(stderr,"keeper: inherited descriptor %ld; no load\n",fd);
            result=-1;
        }
    }
    closedir(d);
    return result;
}
static int no_authority(uint64_t caps[4],gid_t groups[32],int *ngroups)
{
    char buf[8192],*p;
    static const char *keys[]={
        "CapEff:\t","CapPrm:\t","CapInh:\t","CapAmb:\t"
    };
    unsigned i;
    uid_t real_uid,effective_uid,saved_uid;
    gid_t real_gid,effective_gid,saved_gid;
    unsigned long ids[4];
    char end;
    if(getresuid(&real_uid,&effective_uid,&saved_uid)||getresgid(&real_gid,&effective_gid,&saved_gid)||!real_uid||real_uid!=effective_uid||real_uid!=saved_uid||real_gid!=effective_gid||real_gid!=saved_gid||prctl(PR_GET_NO_NEW_PRIVS,0,0,0,0)!=1||read_text("/proc/self/status",buf,sizeof(buf)))return -1;
    p=strstr(buf,"Uid:\t");
    if(!p||sscanf(p,"Uid:\t%lu\t%lu\t%lu\t%lu%c",&ids[0],&ids[1],&ids[2],&ids[3],&end)!=5||end!='\n')return -1;
    for(i=0;i<4;i++)if(ids[i]!=(unsigned long)real_uid)return -1;
    p=strstr(buf,"Gid:\t");
    if(!p||sscanf(p,"Gid:\t%lu\t%lu\t%lu\t%lu%c",&ids[0],&ids[1],&ids[2],&ids[3],&end)!=5||end!='\n')return -1;
    for(i=0;i<4;i++)if(ids[i]!=(unsigned long)real_gid)return -1;
    for(i=0;i<4;i++){
        char *end;
        unsigned long long v;
        p=strstr(buf,keys[i]);
        if(!p)return -1;
        errno=0;
        v=strtoull(p+strlen(keys[i]),&end,16);
        if(errno||end==p+strlen(keys[i])||(*end!='\n'&&*end!=0)||v)return -1;
        caps[i]=v;
    }
    *ngroups=getgroups(32,groups);
    if(*ngroups<0)return -1;
    for(i=0;i<(unsigned)*ngroups;i++){
        unsigned j;
        for(j=i+1;j<(unsigned)*ngroups;j++)if(groups[j]<groups[i]){
            gid_t t=groups[i];
            groups[i]=groups[j];
            groups[j]=t;
        }
        if(i&&groups[i]==groups[i-1])return -1;
    }
    return 0;
}
/* Inspect each protected ancestor by an O_NOFOLLOW handle. Only the final
 * parent remains locally retained; distribution owns the retained ancestry and
 * settlement lifetime. Protection excludes mutation by the workload identity.
 * No request changes ownership, mode, mount, ACL or filesystem policy. */
static int protected_parent(const char *path,uid_t load_uid,struct stat *last)
{
    char copy[PATH_MAX],*p,*slash;
    int dir,next;
    struct stat st;
    if(path[0]!='/'||strlen(path)>=sizeof(copy))return -1;
    strcpy(copy,path);
    dir=open("/",O_PATH|O_DIRECTORY|O_CLOEXEC);
    if(dir<0)return -1;
    if(fstat(dir,&st)||(st.st_mode&0022)||st.st_uid==load_uid){
        close(dir);
        return -1;
    }
    p=copy+1;
    while((slash=strchr(p,'/'))){
*slash=0;
        if(!*p||!strcmp(p,".")||!strcmp(p,"..")){
            close(dir);
            return -1;
        }
        next=openat(dir,p,O_PATH|O_DIRECTORY|O_NOFOLLOW|O_CLOEXEC);
        close(dir);
        if(next<0)return -1;
        dir=next;
        if(fstat(dir,&st)||(st.st_mode&0022)||st.st_uid==load_uid){
            close(dir);
            return -1;
        }
        p=slash+1;
    }
    if(!*p||!strcmp(p,".")||!strcmp(p,"..")){
        close(dir);
        return -1;
    }
    if(last)*last=st;
    return dir;
}
static int prefix_path(struct keeper *k,const char *path)
{
    char prefix[80];
    size_t n;
    snprintf(prefix,sizeof(prefix),"/run/elogistix-memory-%s/",k->run);
    n=strlen(prefix);
    return !strncmp(path,prefix,n)&&path[n]&&strchr(path+n,'/')==NULL;
}
static int executable_proof(struct keeper *k,char hash[65])
{
    int parent,fd;
    struct stat named,executed,after;
    char buf[65536];
    ssize_t n;
    struct sha256 h;
    off_t bytes=0;
    if(!prefix_path(k,k->exe)||(parent=protected_parent(k->exe,getuid(),NULL))<0)return -1;
    fd=open(k->exe,O_RDONLY|O_NOFOLLOW|O_CLOEXEC);
    close(parent);
    if(fd<0)return -1;
    k->exe_fd=open("/proc/self/exe",O_RDONLY|O_CLOEXEC);
    if(k->exe_fd<0){
        close(fd);
        return -1;
    }
    if(fstat(fd,&named)||fstat(k->exe_fd,&executed)||!S_ISREG(named.st_mode)||named.st_uid==getuid()||(named.st_mode&0022)||(named.st_mode&(S_ISUID|S_ISGID))||named.st_nlink!=1||named.st_size<=0||named.st_size>32*1024*1024||named.st_dev!=executed.st_dev||named.st_ino!=executed.st_ino){
        close(fd);
        return -1;
    }
    errno=0;
    n=fgetxattr(k->exe_fd,"security.capability",NULL,0);
    if(n>=0||(errno!=ENODATA&&errno!=ENOTSUP)){
        close(fd);
        return -1;
    }
    sha_init(&h);
    while((n=read(k->exe_fd,buf,sizeof(buf)))>0){
        if(mono_us()>=k->work||bytes>32*1024*1024-n){
            close(fd);
            return -1;
        }
        bytes+=n;
        sha_update(&h,buf,(size_t)n);
    }
    if(n<0||fstat(k->exe_fd,&after)||bytes!=executed.st_size||after.st_dev!=executed.st_dev||after.st_ino!=executed.st_ino||after.st_size!=executed.st_size||after.st_mtim.tv_sec!=executed.st_mtim.tv_sec||after.st_mtim.tv_nsec!=executed.st_mtim.tv_nsec||after.st_ctim.tv_sec!=executed.st_ctim.tv_sec||after.st_ctim.tv_nsec!=executed.st_ctim.tv_nsec){
        close(fd);
        return -1;
    }
    close(fd);
    sha_finish(&h,hash);
    return 0;
}
static int connect_watchdog(struct keeper *k)
{
    struct sockaddr_un addr;
    struct stat before,after;
    struct pollfd p;
    socklen_t size=sizeof(k->peer);
    int pass=1,r;
    if(!prefix_path(k,k->ipc)||(k->listener_parent=protected_parent(k->ipc,getuid(),NULL))<0||lstat(k->ipc,&before)||!S_ISSOCK(before.st_mode)||before.st_uid==getuid())return -1;
    k->channel=socket(AF_UNIX,SOCK_SEQPACKET|SOCK_CLOEXEC|SOCK_NONBLOCK,0);
    if(k->channel<0||setsockopt(k->channel,SOL_SOCKET,SO_PASSCRED,&pass,sizeof(pass)))return -1;
    memset(&addr,0,sizeof(addr));
    addr.sun_family=AF_UNIX;
    strcpy(addr.sun_path,k->ipc);
    r=connect(k->channel,(struct sockaddr *)&addr,sizeof(addr));
    if(r&&errno!=EINPROGRESS)return -1;
    if(r){
        int err=0;
        socklen_t z=sizeof(err);
        p.fd=k->channel;
        p.events=POLLOUT;
        p.revents=0;
        if(mono_us()>=k->work||poll(&p,1,1000)<=0||getsockopt(k->channel,SOL_SOCKET,SO_ERROR,&err,&z)||err){
            errno=err?err:ETIMEDOUT;
            return -1;
        }
    }
    if(mono_us()>=k->work||lstat(k->ipc,&after)||before.st_dev!=after.st_dev||before.st_ino!=after.st_ino||getsockopt(k->channel,SOL_SOCKET,SO_PEERCRED,&k->peer,&size)||size!=sizeof(k->peer)||k->peer.pid!=k->watchdog_pid||k->peer.uid!=before.st_uid)return -1;
    /* V3 requires the full original peer generation. On ordinary cross-UID
     * Linux, procfs namespace readlink may require authority the load UID lacks.
     * No such denial has been observed on Asus. Do not change permissions or
     * silently substitute claimed namespace labels: fail closed for review. */
    if(generation_read(k->peer.pid,&k->watchdog)||k->watchdog.ticks!=k->watchdog_ticks||strcmp(k->watchdog.boot,k->self.boot)||strcmp(k->watchdog.pidns,k->self.pidns))return -1;
    return watchdog_live(k)?0:-1;
}
static int channel_send(struct keeper *k,const char *data,size_t n)
{
    uint64_t now=mono_us(),deadline=now+RPC_US;
    if(deadline<now)return -1;
    if(deadline>k->cleanup)deadline=k->cleanup;
    while(mono_us()<deadline&&watchdog_live(k)){
        ssize_t z=send(k->channel,data,n,MSG_NOSIGNAL);
        if(z==(ssize_t)n)return mono_us()<deadline&&watchdog_live(k)?0:-1;
        if(z>=0)return -1;
        if(errno!=EAGAIN&&errno!=EWOULDBLOCK&&errno!=EINTR)return -1;
        {
            struct pollfd p={
                .fd=k->channel,.events=POLLOUT
            };
            if(poll(&p,1,10)<0&&errno!=EINTR)return -1;
        }
    }
    return -1;
}
static uint64_t send_event(struct keeper *k,const char *event,const char *body)
{
    char packet[PACKET_MAX+1],ref[65];
    struct json_doc doc;
    int n;
    uint64_t seq;
    if(k->channel_dead||k->nsent==ARRAY_LEN(k->sent)||k->outseq==UINT64_MAX)return 0;
    if(strcmp(event,"FAULT")){
        if(strlen(event)>=sizeof(k->at_event))return 0;
        strcpy(k->at_event,event);
    }
    seq=++k->outseq;
    n=snprintf(packet,sizeof(packet),"{\"v\":3,\"run\":\"%s\",\"sender\":\"KEEPER\",\"seq\":%" PRIu64 ",\"slot\":%u,\"event\":\"%s\",\"request\":null,\"mono_us\":\"%" PRIu64 "\",\"body\":%s}",k->run,seq,k->slot,event,mono_us(),body);
    if(n<0||(size_t)n>PACKET_MAX||json_parse(packet,(size_t)n,&doc)||canonical_digest(body,k->sent[k->nsent].body_ref)||ledger_record(k,"WIRE_SENT",packet,ref)||channel_send(k,packet,(size_t)n))return 0;
    k->sent[k->nsent].seq=seq;
    k->sent[k->nsent].acked=0;
    k->sent[k->nsent].ack_ref[0]=0;
    strcpy(k->sent[k->nsent].local_record_ref,ref);
    strcpy(k->sent[k->nsent].event,event);
    k->nsent++;
    return seq;
}
static int receive_packet(struct keeper *k,struct inbound *out)
{
    char packet[PACKET_MAX+1];
    union{
        struct cmsghdr align;
        char buf[CMSG_SPACE(sizeof(struct ucred))+CMSG_SPACE(8*sizeof(int))];
    }
    control;
    struct iovec iov={
        .iov_base=packet,.iov_len=PACKET_MAX
    };
    struct msghdr msg;
    struct cmsghdr *c;
    struct ucred cred={
        0
    };
    int ncred=0,bad=0;
    ssize_t n;
    struct json_doc doc;
    memset(&msg,0,sizeof(msg));
    memset(&control,0,sizeof(control));
    msg.msg_iov=&iov;
    msg.msg_iovlen=1;
    msg.msg_control=control.buf;
    msg.msg_controllen=sizeof(control.buf);
    n=recvmsg(k->channel,&msg,MSG_DONTWAIT|MSG_CMSG_CLOEXEC);
    if(n<0&&(errno==EAGAIN||errno==EWOULDBLOCK||errno==EINTR))return 0;
    if(n<0)return -1;
    bad=(msg.msg_flags&(MSG_TRUNC|MSG_CTRUNC))!=0;
    for(c=CMSG_FIRSTHDR(&msg);c;c=CMSG_NXTHDR(&msg,c)){
        if(c->cmsg_level==SOL_SOCKET&&c->cmsg_type==SCM_RIGHTS){
            size_t i,count=(c->cmsg_len-CMSG_LEN(0))/sizeof(int);
            int *fds=(int *)CMSG_DATA(c);
            for(i=0;i<count;i++){
                close(fds[i]);
            }
            bad=1;
            continue;
        }
        if(c->cmsg_level!=SOL_SOCKET||c->cmsg_type!=SCM_CREDENTIALS||c->cmsg_len!=CMSG_LEN(sizeof(cred))){
            bad=1;
            continue;
        }
        if(ncred++){
            bad=1;
            continue;
        }
        memcpy(&cred,CMSG_DATA(c),sizeof(cred));
    }
    /* recvmsg installs SCM_RIGHTS before returning, including on truncation.
     * The complete ancillary walk above precedes EVERY rejection/EOF branch. */
    if(n==0){
        k->channel_dead=1;
        return -1;
    }
    if(bad)return -1;
    if(ncred!=1||cred.pid!=k->peer.pid||cred.uid!=k->peer.uid||cred.gid!=k->peer.gid||!watchdog_live(k)||k->inseq==UINT64_MAX||json_parse(packet,(size_t)n,&doc)||validate_envelope(&doc,k->run,k->slot,k->inseq+1,out)||out->mono>mono_us())return -1;
    return 1;
}
static int apply_inbound(struct keeper *k,const struct inbound *in)
{
    char detail[300],ref[65];
    unsigned i;
    if(in->kind==IN_QUIESCE){
        if(in->cleanup!=k->cleanup)return -1;
        k->quiesce=1;
        snprintf(detail,sizeof(detail),"{\"reason\":\"%s\",\"watchdog_seq\":%" PRIu64 "}",in->reason,in->seq);
        return ledger_record(k,"QUIESCE_RECEIVED",detail,ref);
    }
    if(in->kind==IN_PERMIT){
        if(k->permit||k->quiesce||in->work!=k->work||in->cleanup!=k->cleanup||!deadline_pair_valid(k->t0,k->work,k->cleanup,mono_us()))return -1;
        strcpy(k->unit_ref,in->unit);
        strcpy(k->physical_ref,in->physical);
        strcpy(k->scenario,in->scenario);
        k->permit=1;
        snprintf(detail,sizeof(detail),"{\"unit_binding_ref\":\"%s\",\"physical_binding_ref\":\"%s\",\"watchdog_seq\":%" PRIu64 "}",in->unit,in->physical,in->seq);
        return ledger_record(k,"LOAD_PERMIT_RECEIVED",detail,ref);
    }
    for(i=0;i<k->nsent;i++)if(k->sent[i].seq==in->accepted){
        if(k->sent[i].acked)return -1;
        k->sent[i].acked=1;
        strcpy(k->sent[i].ack_ref,in->hash);
        if(!strcmp(k->sent[i].event,"KEEPER_HELLO")){
            char token[65];
            if(record_initial_thread(k,&k->self,k->sent[i].body_ref,token))return -1;
            k->initial_thread_recorded=1;
        }
        snprintf(detail,sizeof(detail),"{\"accepted_seq\":%" PRIu64 ",\"watchdog_ledger_record_sha256\":\"%s\"}",in->accepted,in->hash);
        return ledger_record(k,"DURABLE_ACK_RECEIVED",detail,ref);
    }
    return -1;
}
static int pump(struct keeper *k,int ms)
{
    struct pollfd p[2]={
        {
            .fd=k->channel,.events=POLLIN
        },{
            .fd=k->watchdog.pidfd,.events=POLLIN
        }
    };
    struct inbound in;
    int r;
    if(stop_signal){
        failure(k,"KEEPER_SIGNAL");
        return -1;
    }
    if(mono_us()>=k->cleanup){
        failure(k,"CLEANUP_DEADLINE");
        return -1;
    }
    r=poll(p,2,ms);
    if(r<0&&errno!=EINTR){
        failure(k,"POLL_FAILED");
        return -1;
    }
    if(p[1].revents||!watchdog_live(k)){
        k->channel_dead=1;
        failure(k,"WATCHDOG_DEATH");
        return -1;
    }
    if(p[0].revents&(POLLHUP|POLLERR|POLLNVAL)){
        k->channel_dead=1;
        failure(k,"WATCHDOG_CHANNEL_LOST");
        return -1;
    }
    {
        unsigned packets=0;
        while(packets++<32&&(r=receive_packet(k,&in))>0){
            if(mono_us()>=k->cleanup){
                failure(k,"CLEANUP_DEADLINE");
                return -1;
            }
            if(apply_inbound(k,&in)){
                failure(k,"PROTOCOL_REPLAY_OR_BINDING");
                return -1;
            }
            k->inseq=in.seq;
            if(k->quiesce)break;
        }
    }
    if(r<0){
        failure(k,"PROTOCOL_OR_CREDENTIALS");
        return -1;
    }
    return 0;
}
static int work_allowed(struct keeper *k)
{
    return k->permit&&k->initial_thread_recorded&&!k->quiesce&&!k->failed&&!stop_signal&&mono_us()<k->work&&watchdog_live(k);
}
static int seq_acked(struct keeper *k,uint64_t seq)
{
    unsigned i;
    for(i=0;i<k->nsent;i++)if(k->sent[i].seq==seq)return k->sent[i].acked;
    return 0;
}
/* Children retain only their gate, lifecycle pipe, and, for the intentionally
 * reparented descendant, the ORIGINAL keeper-local kernel pidfd. */
static void child_close_fds(int a,int b,int c,int keep_fourth)
{
    DIR *d=opendir("/proc/self/fd");
    struct dirent *e;
    int own;
    if(!d)_exit(70);
    own=dirfd(d);
    while((e=readdir(d))){
        char *end;
        long fd=strtol(e->d_name,&end,10);
        if(*e->d_name&&!*end&&fd>2&&fd!=own&&fd!=a&&fd!=b&&fd!=c&&fd!=keep_fourth)close((int)fd);
    }
    closedir(d);
}
static int child_keeper_alive(int pidfd)
{
    struct pollfd p={
        .fd=pidfd,.events=POLLIN
    };
    return pidfd<0||poll(&p,1,0)==0;
}
static int child_gate(int gate,int monitor,uint64_t deadline)
{
    for(;;){
        struct pollfd p[2]={
            {
                .fd=gate,.events=POLLIN
            },{
                .fd=monitor,.events=POLLIN
            }
        };
        char byte;
        int r;
        uint64_t now=mono_us();
        if(now>=deadline||!child_keeper_alive(monitor))return -1;
        r=poll(p,monitor>=0?2:1,10);
        if(r<0&&errno==EINTR)continue;
        if(r<0||(monitor>=0&&p[1].revents))return -1;
        if(p[0].revents&POLLIN){
            r=(int)read(gate,&byte,1);
            if(r==1&&byte=='G'&&mono_us()<deadline)return 0;
            return -1;
        }
        if(p[0].revents&(POLLHUP|POLLERR|POLLNVAL))return -1;
    }
}
struct life_event {
    uint32_t magic,kind;
    pid_t pid,tid;
    uint64_t at;
    uint64_t before,after;
    int result;
};
static void life_emit(int fd,unsigned kind)
{
    struct life_event e={
        .magic=0x454c4f47,.kind=kind,.pid=getpid(),.tid=(pid_t)syscall(SYS_gettid),.at=mono_us()
    };
    if(fd>=0&&(write(fd,&e,sizeof(e))!=(ssize_t)sizeof(e)))_exit(70);
}
static void life_creation(int fd,uint64_t before,uint64_t after,int result)
{
    struct life_event e={
        .magic=0x454c4f47,.kind=5,.pid=getpid(),.tid=(pid_t)syscall(SYS_gettid),.at=mono_us(),.before=before,.after=after,.result=result
    };
    if(write(fd,&e,sizeof(e))!=(ssize_t)sizeof(e))_exit(70);
}
static int synthetic_load(uint64_t deadline,int monitor,int ready_report)
{
    unsigned char *mem;
    size_t i;
    uint64_t finish;
    uint64_t caps[4];
    gid_t groups[32];
    int ng;
    if(mono_us()>=deadline||!child_keeper_alive(monitor)||no_authority(caps,groups,&ng))return 78;
    mem=mmap(NULL,LOAD_BYTES,PROT_READ|PROT_WRITE,MAP_PRIVATE|MAP_ANONYMOUS,-1,0);
    if(mem==MAP_FAILED)return 70;
    if(mono_us()>=deadline||!child_keeper_alive(monitor)){
        munmap(mem,LOAD_BYTES);
        return 78;
    }
    for(i=0;i<LOAD_BYTES;i+=4096){
        if(mono_us()>=deadline||!child_keeper_alive(monitor)){
            munmap(mem,LOAD_BYTES);
            return 78;
        }
        ((volatile unsigned char *)mem)[i]=(unsigned char)(i/4096);
    }
    if(mono_us()>=deadline||!child_keeper_alive(monitor)){
        munmap(mem,LOAD_BYTES);
        return 78;
    }
    if(ready_report>=0)life_emit(ready_report,4);
    finish=mono_us()+LOAD_HOLD_US;
    if(finish>deadline)finish=deadline;
    while(mono_us()<finish&&child_keeper_alive(monitor)){
        struct timespec z={
            0,10000000
        };
        nanosleep(&z,NULL);
    }
    i=mono_us()>=deadline||!child_keeper_alive(monitor)?78:0;
    munmap(mem,LOAD_BYTES);
    return (int)i;
}
struct thread_arg {
    uint64_t deadline;
    int report,gate;
    atomic_int gate_accepted;
};
static void *survivor_worker(void *v)
{
    struct thread_arg *a=v;
    int r;
    life_emit(a->report,1);
    if(child_gate(a->gate,-1,a->deadline))_exit(78);
    close(a->gate);
    atomic_store_explicit(&a->gate_accepted,1,memory_order_release);
    r=synthetic_load(a->deadline,-1,-1);
    life_emit(a->report,3);
    if(r)_exit(r);
    return NULL;
}
static void child_run(struct keeper *k,int gate,int report,int mode,int descendant_gate,int descendant_report,int second_gate)
{
    pid_t keeper_pid=k->self.pid;
    int monitor=mode==3?k->self.pidfd:-1;
    if(mode!=3){
        if(prctl(PR_SET_PDEATHSIG,SIGKILL)||getppid()!=keeper_pid)_exit(78);
    }
    signal(SIGTERM,mode==3?SIG_IGN:SIG_DFL);
    signal(SIGINT,SIG_DFL);
    signal(SIGPIPE,SIG_IGN);
    if(mode==2){
        pid_t descendant;
        child_close_fds(gate,descendant_gate,descendant_report,k->self.pidfd);
        /* First G follows helper SPAWNED ACK; second G authorizes helper exit
         * after the keeper pins the original blocked descendant for adoption. */
        if(child_gate(gate,-1,k->work))_exit(78);
        if(mono_us()>=k->work)_exit(78);
        descendant=fork();
        if(descendant<0)_exit(70);
        if(!descendant){
            child_close_fds(descendant_gate,descendant_report,k->self.pidfd,-1);
            if(child_gate(descendant_gate,k->self.pidfd,k->work))_exit(78);
            close(descendant_gate);
            signal(SIGTERM,SIG_IGN);
            _exit(synthetic_load(k->work,k->self.pidfd,descendant_report));
        }
        if(write(descendant_report,&descendant,sizeof(descendant))!=(ssize_t)sizeof(descendant))_exit(70);
        close(descendant_gate);
        close(descendant_report);
        if(child_gate(second_gate,-1,k->work))_exit(78);
        _exit(0);
    }
    child_close_fds(gate,report,monitor,-1);
    if(child_gate(gate,monitor,k->work))_exit(78);
    if(mode==1){
        pthread_t thread;
        pthread_attr_t attr;
        static struct thread_arg a;
        uint64_t before,after;
        int rc;
        a.deadline=k->work;
        a.report=report;
        a.gate=gate;
        atomic_init(&a.gate_accepted,0);
        if(mono_us()>=k->work||pthread_attr_init(&attr)||pthread_attr_setstacksize(&attr,1024u*1024u))_exit(70);
        before=mono_us();
        if(before>=k->work)_exit(78);
        rc=pthread_create(&thread,&attr,survivor_worker,&a);
        after=mono_us();
        life_creation(report,before,after,rc);
        if(rc)_exit(70);
        if(after>=k->work)_exit(78);
        pthread_attr_destroy(&attr);
        /* Keep /proc/<pid>/task/<tid> available until the keeper has registered
         * this real child-owned thread and received its durable ACK. Only the
         * worker reads/closes the shared gate FD. Its atomic release lets the
         * leader exit after that ACK. Static storage survives pthread_exit. */
        while(!atomic_load_explicit(&a.gate_accepted,memory_order_acquire)){
            struct timespec z={0,1000000};
            if(mono_us()>=k->work)_exit(78);
            nanosleep(&z,NULL);
        }
        life_emit(report,2);
        pthread_exit(NULL);
    }
    close(gate);
    _exit(synthetic_load(k->work,monitor,report));
}
static int pidfd_signal(int fd,int sig)
{
#ifdef SYS_pidfd_send_signal
    return (int)syscall(SYS_pidfd_send_signal,fd,sig,NULL,0);
#else
    (void)fd;
    (void)sig;
    errno=ENOSYS;
    return -1;
#endif
}
static int register_owned(struct keeper *k,pid_t pid,int gate,int report,int descendant,pid_t creator,const char *parent_ref,const char *role,int release)
{
    struct owned *o;
    char detail[1100],body[1200];
    pid_t actual_parent;
    uint64_t ticks;
    char state;
    if(k->nowned==MAX_OWNED)return -1;
    /* Ownership is retained even if identity acquisition or durable recording
     * fails. Such children never receive G and are still drained by their owner. */
    o=&k->owned[k->nowned++];
    memset(o,0,sizeof(*o));
    o->gen.pidfd=-1;
    o->gen.pid=pid;
    o->gate=gate;
    o->report=report;
    o->descendant=descendant;
    o->creator=creator;
    if(generation_read(pid,&o->gen)||proc_stat(pid,0,&ticks,&state,&actual_parent)||actual_parent!=creator||strcmp(o->gen.boot,k->self.boot)||strcmp(o->gen.pidns,k->self.pidns)){
        /* A direct unreaped fork PID cannot be reused; a failed descendant
         * identity must NEVER be reacquired/signalled by an unverified PID. */
        if(descendant&&o->gen.pidfd>=0){
            close(o->gen.pidfd);
            o->gen.pidfd=-1;
        }
        if(!descendant&&o->gen.pidfd<0)o->gen.pidfd=local_pidfd(pid);
        return -1;
    }
    snprintf(detail,sizeof(detail),"{\"child_generation\":%s,\"parent_generation_ref\":\"%s\",\"role\":\"%s\"}",o->gen.json,parent_ref,role);
    if(ledger_record(k,"SPAWNED",detail,o->spawn))return -1;
    snprintf(body,sizeof(body),"{\"child_generation\":%s,\"parent_generation_ref\":\"%s\",\"role\":\"%s\",\"spawn_record_ref\":\"%s\"}",o->gen.json,parent_ref,role,o->spawn);
    o->seq=send_event(k,"SPAWNED",body);
    if(!o->seq)return -1;
    while(!seq_acked(k,o->seq)&&work_allowed(k))if(pump(k,10))return -1;
    if(!seq_acked(k,o->seq)||!work_allowed(k))return -1;
    if(canonical_digest(body,o->spawn_body_ref)||record_initial_thread(k,&o->gen,o->spawn_body_ref,o->initial_thread_ref))return -1;
    o->initial_thread_recorded=1;
    /* This is the sole load release. SPAWNED append+fsync and exact authenticated
     * per-channel watchdog ACK both precede the byte consumed by this child. */
    if(release&&(write(gate,"G",1)!=1||!work_allowed(k)))return -1;
    return 0;
}
static int spawn_direct(struct keeper *k,int mode,int release)
{
    int gate[2]={
        -1,-1
    },report[2]={
        -1,-1
    };
    pid_t pid;
    if(!work_allowed(k)||pipe2(gate,O_CLOEXEC))return -1;
    if(pipe2(report,O_CLOEXEC|O_NONBLOCK)){
        close(gate[0]);
        close(gate[1]);
        return -1;
    }
    if(!work_allowed(k)){
        close(gate[0]);
        close(gate[1]);
        close(report[0]);
        close(report[1]);
        return -1;
    }
    pid=fork();
    if(pid<0){
        close(gate[0]);
        close(gate[1]);
        close(report[0]);
        close(report[1]);
        return -1;
    }
    if(!pid){
        close(gate[1]);
        close(report[0]);
        child_run(k,gate[0],report[1],mode,-1,-1,-1);
        _exit(70);
    }
    close(gate[0]);
    close(report[1]);
    if(register_owned(k,pid,gate[1],report[0],0,k->self.pid,k->self.ref,mode==1?"SURVIVOR":"LOAD",release)){
        /* PID remains our unreaped original child; no PID-only external target. */
        if(k->nowned==0||k->owned[k->nowned-1].gen.pid!=pid){
            close(gate[1]);
            close(report[0]);
            kill(pid,SIGKILL);
            fprintf(stderr,"keeper: child registration failed; authentic spawn receipt missing\n");
        }
        return -1;
    }
    if(release&&mode!=1){
        close(gate[1]);
        k->owned[k->nowned-1].gate=-1;
    }
    return 0;
}
static int spawn_descendant(struct keeper *k)
{
    int gate[2]={
        -1,-1
    },descgate[2]={
        -1,-1
    },report[2]={
        -1,-1
    },result=-1;
    pid_t helper,descendant=0;
    struct owned *parent;
    struct generation original_descendant;
    pid_t actual_parent;
    uint64_t ticks;
    char state;
    ssize_t n;
    unsigned i;
    memset(&original_descendant,0,sizeof(original_descendant));
    original_descendant.pidfd=-1;
    if(!work_allowed(k)||pipe2(gate,O_CLOEXEC)||pipe2(descgate,O_CLOEXEC)||pipe2(report,O_CLOEXEC|O_NONBLOCK))goto end;
    if(!work_allowed(k))goto end;
    helper=fork();
    if(helper<0)goto end;
    if(!helper){
        close(gate[1]);
        close(descgate[1]);
        close(report[0]);
        child_run(k,gate[0],-1,2,descgate[0],report[1],gate[0]);
        _exit(70);
    }
    close(gate[0]);
    gate[0]=-1;
    close(descgate[0]);
    descgate[0]=-1;
    close(report[1]);
    report[1]=-1;
    if(register_owned(k,helper,gate[1],-1,0,k->self.pid,k->self.ref,"LOAD",1))goto end;
    parent=&k->owned[k->nowned-1];
    while(work_allowed(k)){
        n=read(report[0],&descendant,sizeof(descendant));
        if(n==(ssize_t)sizeof(descendant))break;
        if(n==0||(n<0&&errno!=EAGAIN&&errno!=EINTR))goto end;
        if(pump(k,10))goto end;
    }
    if(!work_allowed(k)||descendant<=0)goto end;
    /* Pin the actual controlled grandchild while its registered helper parent
     * is still alive. No SPAWNED is published and no load is released yet. */
    if(generation_read(descendant,&original_descendant)||proc_stat(descendant,0,&ticks,&state,&actual_parent)||actual_parent!=helper||ticks!=original_descendant.ticks||strcmp(original_descendant.boot,k->self.boot)||strcmp(original_descendant.pidns,k->self.pidns)||!child_keeper_alive(parent->gen.pidfd))goto end;
    if(!work_allowed(k)||write(gate[1],"G",1)!=1||!work_allowed(k))goto end;
    close(gate[1]);
    gate[1]=-1;
    parent->gate=-1;
    /* Helper exits only after the second gate byte. The keeper records its real
     * waitpid consumption, and then proves actual subreaper adoption of the
     * pinned original grandchild. It remains blocked throughout this phase. */
    while(work_allowed(k)&&!parent->done){
        (void)reap_owned(k);
        if(k->failed||pump(k,10))goto end;
    }
    if(!work_allowed(k)||!parent->done)goto end;
    while(work_allowed(k)){
        if(!child_keeper_alive(original_descendant.pidfd)||proc_stat(descendant,0,&ticks,&state,&actual_parent)||ticks!=original_descendant.ticks||state=='Z'||state=='X')goto end;
        if(actual_parent==k->self.pid)break;
        if(actual_parent!=helper||pump(k,10))goto end;
    }
    if(!work_allowed(k)||actual_parent!=k->self.pid)goto end;
    if(register_owned(k,descendant,descgate[1],report[0],1,k->self.pid,k->self.ref,"DESCENDANT",0)){
        report[0]=-1;
        goto end;
    }
    report[0]=-1;
    if(strcmp(k->owned[k->nowned-1].gen.ref,original_descendant.ref)||!work_allowed(k)||write(descgate[1],"G",1)!=1||!work_allowed(k))goto end;
    result=0;
    end:
    /* Closing both release pipes makes even an unregistered grandchild abort
     * without a load. The subreaper also consumes unexpected adopted children. */
    if(original_descendant.pidfd>=0)close(original_descendant.pidfd);
    for(i=0;i<k->nowned;i++)if(k->owned[i].gate==gate[1]||k->owned[i].gate==descgate[1])k->owned[i].gate=-1;
    for(i=0;i<2;i++){
        if(gate[i]>=0)close(gate[i]);
        if(descgate[i]>=0)close(descgate[i]);
        if(report[i]>=0)close(report[i]);
    }
    return result;
}
static int register_created_thread(struct keeper *k,struct owned *o)
{
    uint64_t thread_ticks;
    char state;
    pid_t parent;
    char facts[1000],body[800];
    int n;
    if(o->thread_seq||!o->creation_seen||!o->survivor_tid)return 0;
    if(!initial_thread_codec_ready()||!o->initial_thread_recorded){
        failure(k,"THREAD_CODEC_PENDING");
        return -1;
    }
    if(o->creating_tid!=o->gen.pid||o->survivor_tid==o->creating_tid||o->create_before>o->create_after||o->create_after>=k->work||proc_stat(o->gen.pid,o->survivor_tid,&thread_ticks,&state,&parent)||state=='Z'||state=='X'){
        failure(k,"THREAD_IDENTITY_OR_CREATION");
        return -1;
    }
    o->survivor_ticks=thread_ticks;
    /* Authenticated keeper relay of its original child's fork-private creation
     * fact, NOT a claim that the keeper process called the child's pthread API.
     * The child brackets the actual pthread_create call and the kernel TID is
     * checked while that worker is blocked. Native/ledger producer verification
     * by the watchdog remains independent of this serialized body. */
    n=snprintf(facts,sizeof(facts),"{\"after_us\":\"%" PRIu64 "\",\"before_us\":\"%" PRIu64 "\",\"creator_tid\":%ld,\"creating_thread_ref\":\"%s\",\"owner_process_generation_ref\":\"%s\",\"pthread_create_return\":0,\"thread_start_ticks\":\"%" PRIu64 "\",\"thread_tid\":%ld}",o->create_after,o->create_before,(long)o->creating_tid,o->initial_thread_ref,o->gen.ref,thread_ticks,(long)o->survivor_tid);
    if(n<0||(size_t)n>=sizeof(facts)||canonical_digest(facts,o->thread_ref)||!strcmp(o->thread_ref,o->initial_thread_ref)||ledger_record(k,"THREAD_CREATION_SYSCALL",facts,o->thread_creation_ref)){
        failure(k,"THREAD_FACT_ENCODING");
        return -1;
    }
    n=snprintf(body,sizeof(body),"{\"owner_process_generation_ref\":\"%s\",\"thread_creation_record_ref\":\"%s\",\"thread_ref\":\"%s\",\"creating_thread_ref\":\"%s\",\"before_us\":\"%" PRIu64 "\",\"after_us\":\"%" PRIu64 "\"}",o->gen.ref,o->thread_creation_ref,o->thread_ref,o->initial_thread_ref,o->create_before,o->create_after);
    if(n<0||(size_t)n>=sizeof(body)||(o->thread_seq=send_event(k,"THREAD_CREATED",body))==0){
        failure(k,"THREAD_CREATED_DELIVERY");
        return -1;
    }
    while(!seq_acked(k,o->thread_seq)&&work_allowed(k))if(pump(k,10))return -1;
    if(k->quiesce)return 0;
    if(!seq_acked(k,o->thread_seq)||!work_allowed(k)){
        failure(k,"THREAD_ACK_DEADLINE");
        return -1;
    }
    if(o->gate<0||write(o->gate,"G",1)!=1||!work_allowed(k)){
        failure(k,"THREAD_RELEASE_FAILED");
        return -1;
    }
    close(o->gate);
    o->gate=-1;
    return 0;
}
static void life_observe(struct keeper *k,struct owned *o)
{
    struct life_event e;
    ssize_t n;
    char detail[600],ref[65];
    uint64_t ticks;
    char state;
    pid_t parent;
    if(o->report<0)return;
    while((n=read(o->report,&e,sizeof(e)))==(ssize_t)sizeof(e)){
        if(e.magic!=0x454c4f47||e.pid!=o->gen.pid||e.kind<1||e.kind>5||e.at>mono_us()){
            failure(k,"LOCAL_LIFECYCLE_PROTOCOL");
            return;
        }
        if(e.kind==1)o->survivor_tid=e.tid;
        if(e.kind==4){
            o->load_ready=1;
            o->ready_at=e.at;
        }
        if(e.kind==5){
            snprintf(detail,sizeof(detail),"{\"after_us\":\"%" PRIu64 "\",\"before_us\":\"%" PRIu64 "\",\"creator_tid\":%ld,\"owner_process_generation_ref\":\"%s\",\"pthread_create_return\":%d}",e.after,e.before,(long)e.tid,o->gen.ref,e.result);
            if(ledger_record(k,"CHILD_PTHREAD_CREATE_RESULT",detail,ref)){
                failure(k,"LEDGER_IO");
                return;
            }
            if(e.result||o->creation_seen||e.before>e.after||e.after>e.at||e.tid!=o->gen.pid){
                failure(k,"THREAD_CREATE_RESULT");
                return;
            }
            o->creation_seen=1;
            o->create_before=e.before;
            o->create_after=e.after;
            o->creating_tid=e.tid;
        }
        snprintf(detail,sizeof(detail),"{\"pid\":%ld,\"tid\":%ld,\"event\":%u,\"at_us\":\"%" PRIu64 "\",\"is_reap_receipt\":false}",(long)e.pid,(long)e.tid,e.kind,e.at);
        if(ledger_record(k,e.kind==2?"LEADER_PTHREAD_EXIT_INTENT":"THREAD_LIFECYCLE",detail,ref))failure(k,"LEDGER_IO");
    }
    if(n==0){
        close(o->report);
        o->report=-1;
    }
    else if(n>0||(n<0&&errno!=EAGAIN&&errno!=EINTR)){
        failure(k,"LOCAL_LIFECYCLE_IO");
        return;
    }
    if(register_created_thread(k,o))return;
    if(o->survivor_tid&&!o->leader_observed&&!proc_stat(o->gen.pid,0,&ticks,&state,&parent)&&ticks==o->gen.ticks&&state=='Z'){
        uint64_t thread_ticks;
        char thread_state;
        /* The leader's task directory may disappear after pthread_exit. A
         * direct TID lookup, original start_ticks and actual Tgid still bind
         * the live survivor without pretending the leader alone was reaped. */
        if(o->survivor_ticks&&!proc_stat(o->survivor_tid,0,&thread_ticks,&thread_state,&parent)&&thread_ticks==o->survivor_ticks&&thread_state!='Z'&&thread_state!='X'&&thread_owner_is(o->survivor_tid,o->gen.pid)){
            o->leader_observed=1;
            snprintf(detail,sizeof(detail),"{\"leader_pid\":%ld,\"leader_start_ticks\":\"%" PRIu64 "\",\"leader_state\":\"Z\",\"survivor_tid\":%ld,\"survivor_start_ticks\":\"%" PRIu64 "\",\"is_group_reap_receipt\":false}",(long)o->gen.pid,o->gen.ticks,(long)o->survivor_tid,thread_ticks);
            if(ledger_record(k,"LEADER_EXIT_SURVIVOR_LIVE_OBSERVED",detail,ref))failure(k,"LEDGER_IO");
        }
    }
}
static int reap_owned(struct keeper *k)
{
    unsigned i;
    int live=0;
    for(i=0;i<k->nowned;i++){
        struct owned *o=&k->owned[i];
        pid_t r;
        int status=0;
        uint64_t before,after;
        char detail[3000],body[3200],receipt[2500],ref[65];
        life_observe(k,o);
        if(o->done)continue;
        before=mono_us();
        r=waitpid(o->gen.pid,&status,WNOHANG);
        after=mono_us();
        if(!r){
            live++;
            continue;
        }
        if(r<0){
            if(errno==EINTR){
                live++;
                continue;
            }
            if(errno==ECHILD&&o->descendant){
                unsigned j;
                int creator_live=0;
                for(j=0;j<k->nowned;j++)if(k->owned[j].gen.pid==o->creator&&!k->owned[j].done)creator_live=1;
                if(creator_live){
                    live++;
                    continue;
                }
            }
            failure(k,"AUTHENTIC_REAP_MISSING");
            live++;
            continue;
        }
        if(!waitpid_consumed(o->gen.pid,r,status)){
            failure(k,"WAIT_NOT_TERMINAL");
            live++;
            continue;
        }
        o->done=1;
        if(!lower_hex(o->gen.ref,64)||!lower_hex(o->spawn,64)){
            snprintf(detail,sizeof(detail),"{\"requested_pid\":%ld,\"returned_pid\":%ld,\"options\":\"WNOHANG\",\"raw_wait_status\":%u,\"before_us\":\"%" PRIu64 "\",\"after_us\":\"%" PRIu64 "\",\"authentic_spawn_missing\":true}",(long)o->gen.pid,(long)r,(unsigned)status,before,after);
            if(ledger_record(k,"UNREGISTERED_WAIT_CONSUMED",detail,ref))failure(k,"LEDGER_IO");
            if(o->gen.pidfd>=0)close(o->gen.pidfd);
            o->gen.pidfd=-1;
            failure(k,"AUTHENTIC_SPAWN_MISSING");
            continue;
        }
        if(format_waitpid_receipt(&o->gen,&k->self,o->gen.pid,r,status,before,after,receipt,sizeof(receipt))){
            failure(k,"WAIT_RECEIPT_ENCODING");
            continue;
        }
        snprintf(detail,sizeof(detail),"{\"receipt\":%s}",receipt);
        if(ledger_record(k,"REAPED",detail,ref)){
            failure(k,"LEDGER_IO");
            continue;
        }
        if(canonical_digest(receipt,o->reap_receipt_ref)){
            failure(k,"REAP_RECEIPT_DIGEST");
            continue;
        }
        snprintf(body,sizeof(body),"{\"receipt\":%s}",receipt);
        if(!k->channel_dead&&!send_event(k,"REAPED",body)){
            k->channel_dead=1;
            failure(k,"REAP_DELIVERY_FAILED");
        }
        close(o->gen.pidfd);
        o->gen.pidfd=-1;
        if(o->gate>=0){
            close(o->gate);
            o->gate=-1;
        }
        if(WIFEXITED(status)&&WEXITSTATUS(status)!=0)failure(k,WEXITSTATUS(status)==78?"LATE_LOAD_OR_CHILD_IDENTITY":"CHILD_FAILURE");
        else if(WIFSIGNALED(status)&&!k->quiesce&&WTERMSIG(status)!=o->expected_signal)failure(k,"UNEXPECTED_CHILD_DEATH");
    }
    if(!live){
        pid_t r;
        int status;
        uint64_t before=mono_us(),after;
        char detail[300],ref[65];
        r=waitpid(-1,&status,WNOHANG);
        after=mono_us();
        if(r>0){
            snprintf(detail,sizeof(detail),"{\"requested_pid_argument\":\"-1\",\"returned_pid\":%ld,\"raw_wait_status\":%u,\"before_us\":\"%" PRIu64 "\",\"after_us\":\"%" PRIu64 "\",\"authentic_spawn_missing\":true}",(long)r,(unsigned)status,before,after);
            if(ledger_record(k,"UNREGISTERED_ADOPTED_WAIT_CONSUMED",detail,ref))failure(k,"LEDGER_IO");
            failure(k,"UNREGISTERED_ADOPTED_CHILD");
            live=1;
        }
        else if(r==0||errno==EINTR){
            live=1;
        }
        else if(errno!=ECHILD){
            failure(k,"WAIT_UNKNOWN_CHILD_FAILED");
            live=1;
        }
    }
    return live;
}
static void exercise_descendant(struct keeper *k)
{
    unsigned i;
    for(i=0;i<k->nowned;i++){
        struct owned *o=&k->owned[i];
        char detail[500],ref[65],state;
        pid_t parent;
        uint64_t ticks,before,after;
        struct pollfd p={
            .fd=o->gen.pidfd,.events=POLLIN
        };
        if(!o->descendant||o->done||o->term_verified||!o->load_ready||!work_allowed(k))continue;
        if(!o->term_sent){
            before=mono_us();
            if(pidfd_signal(o->gen.pidfd,SIGTERM)){
                failure(k,"DESCENDANT_TERM_FAILED");
                return;
            }
            after=mono_us();
            o->term_sent=1;
            o->term_at=after;
            snprintf(detail,sizeof(detail),"{\"target_generation_ref\":\"%s\",\"signal\":\"SIGTERM\",\"syscall_return\":0,\"before_us\":\"%" PRIu64 "\",\"after_us\":\"%" PRIu64 "\"}",o->gen.ref,before,after);
            if(ledger_record(k,"OWNED_DESCENDANT_TERM_SENT",detail,ref))failure(k,"LEDGER_IO");
        }
        else if(mono_us()-o->term_at>=50000){
            /* Original pinned process remains alive after actual SIGTERM;
             * this is scenario evidence, not a termination/reap certificate. */
            before=mono_us();
            if(poll(&p,1,0)!=0||proc_stat(o->gen.pid,0,&ticks,&state,&parent)||ticks!=o->gen.ticks||state=='Z'||state=='X'){
                failure(k,"DESCENDANT_TERM_SURVIVAL_MISSING");
                return;
            }
            after=mono_us();
            if(!work_allowed(k)){
                failure(k,"DESCENDANT_LATE_SIGNAL");
                return;
            }
            o->term_verified=1;
            o->expected_signal=SIGKILL;
            snprintf(detail,sizeof(detail),"{\"target_generation_ref\":\"%s\",\"signal\":\"SIGTERM\",\"survived\":true,\"before_us\":\"%" PRIu64 "\",\"after_us\":\"%" PRIu64 "\",\"is_reap_receipt\":false}",o->gen.ref,before,after);
            if(ledger_record(k,"DESCENDANT_IGNORED_TERM_OBSERVED",detail,ref)||pidfd_signal(o->gen.pidfd,SIGKILL))failure(k,"DESCENDANT_KILL_FAILED");
        }
    }
}
static int release_overlap(struct keeper *k)
{
    unsigned i;
    char detail[400],ref[65];
    if(k->nowned!=2||!work_allowed(k))return -1;
    for(i=0;i<2;i++)if(!seq_acked(k,k->owned[i].seq)||k->owned[i].gate<0)return -1;
    snprintf(detail,sizeof(detail),"{\"first_spawn_record_ref\":\"%s\",\"second_spawn_record_ref\":\"%s\",\"both_watchdog_acks_retained\":true}",k->owned[0].spawn,k->owned[1].spawn);
    if(ledger_record(k,"OVERLAP_RELEASE_PAIR",detail,ref))return -1;
    for(i=0;i<2;i++){
        if(!work_allowed(k)||write(k->owned[i].gate,"G",1)!=1||!work_allowed(k))return -1;
        close(k->owned[i].gate);
        k->owned[i].gate=-1;
    }
    return 0;
}
static void observe_overlap(struct keeper *k)
{
    struct pollfd p[2];
    char detail[400],ref[65];
    uint64_t before,after,end0,end1;
    if(strcmp(k->scenario,"OVERLAP")||k->overlap_verified||k->nowned!=2||k->owned[0].done||k->owned[1].done||!k->owned[0].load_ready||!k->owned[1].load_ready)return;
    end0=k->owned[0].ready_at>UINT64_MAX-LOAD_HOLD_US?UINT64_MAX:k->owned[0].ready_at+LOAD_HOLD_US;
    end1=k->owned[1].ready_at>UINT64_MAX-LOAD_HOLD_US?UINT64_MAX:k->owned[1].ready_at+LOAD_HOLD_US;
    if(end0>k->work)end0=k->work;
    if(end1>k->work)end1=k->work;
    p[0].fd=k->owned[0].gen.pidfd;
    p[1].fd=k->owned[1].gen.pidfd;
    p[0].events=p[1].events=POLLIN;
    p[0].revents=p[1].revents=0;
    before=mono_us();
    if(before>=end0||before>=end1||!work_allowed(k))return;
    if(poll(p,2,0)!=0)return;
    after=mono_us();
    if(after>=end0||after>=end1||!work_allowed(k))return;
    /* Readiness is emitted after page touch; the controlled worker retains its
     * mapping for at least ready_at+LOAD_HOLD_US absent termination. Sticky
     * readiness plus mere process liveness outside that window is insufficient. */
    snprintf(detail,sizeof(detail),"{\"first_generation_ref\":\"%s\",\"second_generation_ref\":\"%s\",\"both_loaded_and_alive\":true,\"before_us\":\"%" PRIu64 "\",\"after_us\":\"%" PRIu64 "\",\"is_reap_receipt\":false}",k->owned[0].gen.ref,k->owned[1].gen.ref,before,after);
    if(ledger_record(k,"OVERLAP_OBSERVED",detail,ref))failure(k,"LEDGER_IO");
    else k->overlap_verified=1;
}
static void cleanup_owned(struct keeper *k)
{
    unsigned i;
    uint64_t now=mono_us();
    k->quiesce=1;
    k->kill_after=now+100000;
    if(k->kill_after>k->cleanup)k->kill_after=now;
    for(i=0;i<k->nowned;i++){
        struct owned *o=&k->owned[i];
        if(o->gate>=0){
            close(o->gate);
            o->gate=-1;
        }
        if(!o->done&&o->gen.pidfd>=0&&pidfd_signal(o->gen.pidfd,SIGTERM)&&errno!=ESRCH)failure(k,"TERM_FAILED");
    }
    while(reap_owned(k)>0&&mono_us()<k->cleanup){
        if(!k->signalled&&mono_us()>=k->kill_after){
            k->signalled=1;
            for(i=0;i<k->nowned;i++)if(!k->owned[i].done&&k->owned[i].gen.pidfd>=0&&pidfd_signal(k->owned[i].gen.pidfd,SIGKILL)&&errno!=ESRCH)failure(k,"KILL_FAILED");
        }
        {
            struct timespec z={
                0,10000000
            };
            nanosleep(&z,NULL);
        }
    }
    /* After suspension / an exhausted budget, still issue the bounded kernel
     * kill to owned pinned identities. No success receipt or timely reap is
     * inferred from this request; external manager Stop remains independent. */
    for(i=0;i<k->nowned;i++)if(!k->owned[i].done&&k->owned[i].gen.pidfd>=0){
        if(pidfd_signal(k->owned[i].gen.pidfd,SIGKILL)&&errno!=ESRCH)failure(k,"KILL_FAILED");
    }
    for(i=0;i<k->nowned;i++)if(!k->owned[i].done)failure(k,"CLEANUP_DEADLINE_UNREAPED");
    if(mono_us()>=k->cleanup)failure(k,"CLEANUP_DEADLINE");
}
static int config_parse(int argc,char **argv,struct keeper *k)
{
    static const char *const flags[]={
        "--run","--slot","--ipc","--t0-us","--work-deadline-us","--cleanup-deadline-us","--watchdog-pid","--watchdog-start-ticks"
    };
    unsigned i;
    uint64_t v;
    memset(k,0,sizeof(*k));
    k->channel=k->ledger=k->exe_fd=k->listener_parent=-1;
    k->self.pidfd=k->watchdog.pidfd=-1;
    memset(k->chain,'0',64);
    k->chain[64]=0;
    if(argc!=17)return -1;
    for(i=0;i<8;i++)if(strcmp(argv[1+2*i],flags[i]))return -1;
    if(!lower_hex(argv[2],32)||parse_u64(argv[4],&v)||v>2||strlen(argv[0])>=sizeof(k->exe)||strlen(argv[6])>=sizeof(k->ipc))return -1;
    strcpy(k->run,argv[2]);
    k->slot=(unsigned)v;
    strcpy(k->exe,argv[0]);
    strcpy(k->ipc,argv[6]);
    if(parse_u64(argv[8],&k->t0)||parse_u64(argv[10],&k->work)||parse_u64(argv[12],&k->cleanup)||parse_u64(argv[14],&v)||!v||v>INT_MAX||parse_u64(argv[16],&k->watchdog_ticks)||!k->watchdog_ticks)return -1;
    k->watchdog_pid=(pid_t)v;
    return deadline_pair_valid(k->t0,k->work,k->cleanup,mono_us())&&prefix_path(k,k->exe)&&prefix_path(k,k->ipc)?0:-1;
}
static int ledger_open(struct keeper *k)
{
    char dir[PATH_MAX],origin[140],line[240];
    int n=snprintf(dir,sizeof(dir),"/tmp/elogistix-keeper-%s-s%u-XXXXXX",k->run,k->slot);
    if(n<0||(size_t)n>=sizeof(dir)||!mkdtemp(dir))return -1;
    n=snprintf(k->ledger_path,sizeof(k->ledger_path),"%s/ledger.jsonl",dir);
    if(n<0||(size_t)n>=sizeof(k->ledger_path))return -1;
    k->ledger=open(k->ledger_path,O_WRONLY|O_APPEND|O_CREAT|O_EXCL|O_NOFOLLOW|O_CLOEXEC,0600);
    if(k->ledger<0)return -1;
    n=snprintf(origin,sizeof(origin),"{\"origin\":\"%" PRIu64 "\",\"run\":\"%s\"}",k->t0,k->run);
    if(n<0||(size_t)n>=sizeof(origin)||canonical_digest(origin,k->chain))return -1;
    n=snprintf(line,sizeof(line),"{\"record\":%s,\"ref\":\"%s\"}\n",origin,k->chain);
    if(n<0||(size_t)n>=sizeof(line)||write_all(k->ledger,line,(size_t)n)||fsync(k->ledger))return -1;
    {
        int fd=open(dir,O_RDONLY|O_DIRECTORY|O_CLOEXEC);
        if(fd<0)return -1;
        n=fsync(fd);
        close(fd);
        if(n)return -1;
    }
    fprintf(stderr,"keeper: retained ledger %s\n",k->ledger_path);
    return 0;
}
int main(int argc,char **argv)
{
    struct keeper k;
    uint64_t caps[4];
    gid_t groups[32];
    int ng,i,live,exitcode=78;
    char exe_hash[65],body[1300],group_json[400],ref[65],detail[900];
    size_t at;
    if(config_parse(argc,argv,&k)||inherited_fds_clean()||no_authority(caps,groups,&ng)){
        fprintf(stderr,"keeper: rejected argv/deadline/normal-UID/NoNewPrivs/capabilities/inherited-FD precheck; no load\n");
        return 78;
    }
    signal(SIGPIPE,SIG_IGN);
    signal(SIGTERM,on_signal);
    signal(SIGINT,on_signal);
    signal(SIGHUP,on_signal);
    if(prctl(PR_SET_CHILD_SUBREAPER,1,0,0,0)||generation_read(getpid(),&k.self)||executable_proof(&k,exe_hash)||ledger_open(&k)||connect_watchdog(&k)){
        fprintf(stderr,"keeper: rejected local executable or watchdog kernel identity; no load\n");
        goto done;
    }
    snprintf(detail,sizeof(detail),"{\"keeper_generation\":%s,\"exe_sha256\":\"%s\",\"watchdog_generation_ref\":\"%s\"}",k.self.json,exe_hash,k.watchdog.ref);
    if(ledger_record(&k,"BOOTSTRAP",detail,ref)){
        failure(&k,"LEDGER_IO");
        goto drain;
    }
    at=0;
    group_json[at++]='[';
    for(i=0;i<ng;i++){
        int n=snprintf(group_json+at,sizeof(group_json)-at,"%s%lu",i?",":"",(unsigned long)groups[i]);
        if(n<0||(size_t)n>=sizeof(group_json)-at){
            failure(&k,"GROUPS_ENCODING");
            goto drain;
        }
        at+=(size_t)n;
    }
    group_json[at++]=']';
    group_json[at]=0;
    /* Library v3 HELLO golden fixes caps as canonical u64 strings and NNP bool. */
    snprintf(body,sizeof(body),"{\"pid\":%ld,\"start_ticks\":\"%" PRIu64 "\",\"exe_sha256\":\"%s\",\"uid\":%lu,\"gid\":%lu,\"groups\":%s,\"no_new_privs\":true,\"cap_eff\":\"0\",\"cap_perm\":\"0\",\"cap_inh\":\"0\",\"cap_amb\":\"0\"}",(long)k.self.pid,k.self.ticks,exe_hash,(unsigned long)getuid(),(unsigned long)getgid(),group_json);
    if(!send_event(&k,"KEEPER_HELLO",body)){
        failure(&k,"HELLO_DELIVERY_FAILED");
        goto drain;
    }
    while((!k.permit||!k.initial_thread_recorded)&&!k.quiesce&&mono_us()<k.work)if(pump(&k,10))break;
    if((!k.permit||!k.initial_thread_recorded)&&!k.quiesce)failure(&k,"LOAD_PERMIT_OR_HELLO_ACK_DEADLINE");
    if(k.quiesce)goto drain;
    if(!strcmp(k.scenario,"OVERLAP")){
        if(spawn_direct(&k,0,0)||spawn_direct(&k,0,0)||release_overlap(&k))failure(&k,"SPAWN_OR_ACK_FAILED");
    }
    else if(!strcmp(k.scenario,"LEADER_EXIT_THREAD_SURVIVES")){
        if(!initial_thread_codec_ready())failure(&k,"THREAD_CODEC_PENDING");
        else if(spawn_direct(&k,1,1))failure(&k,"SPAWN_OR_ACK_FAILED");
    }
    else if(!strcmp(k.scenario,"DESCENDANT_IGNORES_TERM")){
        if(spawn_descendant(&k))failure(&k,"DESCENDANT_REGISTRATION_FAILED");
    }
    else failure(&k,"SCENARIO_INVALID");
    while(!k.quiesce&&(live=reap_owned(&k))>0){
        if(mono_us()>=k.work){
            failure(&k,"WORK_DEADLINE");
            break;
        }
        observe_overlap(&k);
        exercise_descendant(&k);
        if(pump(&k,10))break;
    }
    if(!k.quiesce&&mono_us()>=k.work)failure(&k,"WORK_DEADLINE");
    if(!k.quiesce&&!k.failed){
        for(i=0;i<(int)k.nowned;i++)if(k.owned[i].survivor_tid&&!k.owned[i].leader_observed)failure(&k,"LEADER_SURVIVOR_OBSERVATION_MISSING");
        for(i=0;i<(int)k.nowned;i++)if(k.owned[i].descendant&&!k.owned[i].term_verified)failure(&k,"DESCENDANT_TERM_SCENARIO_MISSING");
        if(!strcmp(k.scenario,"OVERLAP")&&!k.overlap_verified)failure(&k,"OVERLAP_OBSERVATION_MISSING");
        if(!k.failed&&checkpoint_refs(&k))failure(&k,"CHECKPOINT_RECEIPT_SET");
        if(!k.failed){
            snprintf(body,sizeof(body),"{\"spawn_ledger_ref\":\"%s\",\"reap_ledger_ref\":\"%s\",\"keeper_generation_ref\":\"%s\"}",k.spawn_head,k.reap_head,k.self.ref);
            if(!send_event(&k,"CHECKPOINT_READY",body))failure(&k,"CHECKPOINT_DELIVERY_FAILED");
            if(mono_us()>=k.work)failure(&k,"CHECKPOINT_WORK_DEADLINE");
            /* No new load at 50 s. Keep the small keeper resident for the peak
             * reader until authenticated QUIESCE, peer death or original 60 s.
             * Monotonic bounds cannot guarantee wall-time under host suspension. */
            while(!k.quiesce&&mono_us()<k.cleanup)if(pump(&k,10))break;
            if(!k.quiesce)failure(&k,"CHECKPOINT_QUIESCE_DEADLINE");
        }
    }
    drain:
    cleanup_owned(&k);
    exitcode=k.failed?70:0;
    if(k.ledger>=0){
        snprintf(detail,sizeof(detail),"{\"exit_code\":%d,\"keeper_self_reap_claim\":false,\"memory_reclamation\":\"NOT_ESTABLISHED\"}",exitcode);
        if(ledger_record(&k,"LOCAL_FINAL",detail,ref))exitcode=70;
    }
    done:
    if(k.channel>=0)close(k.channel);
    if(k.ledger>=0)close(k.ledger);
    if(k.exe_fd>=0)close(k.exe_fd);
    if(k.listener_parent>=0)close(k.listener_parent);
    if(k.self.pidfd>=0)close(k.self.pidfd);
    if(k.watchdog.pidfd>=0)close(k.watchdog.pidfd);
    return exitcode;
}
