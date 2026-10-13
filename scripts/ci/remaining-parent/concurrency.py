"""Two worker sessions plus a read-only observer; actual PostgreSQL row locks."""
import os,subprocess,sys,time
args=[os.environ['PSQL_BIN'],'-X','-w','-A','-t','-q','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',os.environ['TEST_PG_PORT'],'-U','guard_owner','-d','postgres']
before=os.environ.get('NEGATIVE_CONTROL')=='1'
settings="SET test.actor='10000000-0000-0000-0000-000000000001'; SET test.org='20000000-0000-0000-0000-000000000001'; SET test.actor_role='admin';"
def run(sql,check=True):
 p=subprocess.run(args+['-c',sql],text=True,capture_output=True,timeout=15)
 if check and p.returncode:raise AssertionError(p.stderr)
 return p

def wait_condition(sql, label, timeout=5):
 end=time.monotonic()+timeout
 while time.monotonic()<end:
  if run(sql).stdout.strip()=='t':return
  time.sleep(.03)
 raise AssertionError('condition timed out: '+label)

def blocked_after_parent_change(table,change,call,error=None,existing_guard=False):
 id='50000000-0000-0000-0000-000000000001'
 run(f"TRUNCATE facturas,conceptos_factura,embarques; INSERT INTO {table}(id,organization_id) VALUES ('{id}','20000000-0000-0000-0000-000000000001');")
 if table=='facturas':run(f"INSERT INTO conceptos_factura(factura_id,cantidad,precio_unitario,tipo_iva) VALUES ('{id}',1,100,'gravado_16');")
 a=subprocess.Popen(args,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,bufsize=1)
 a.stdin.write(f"SET application_name='remaining_parent_holder'; BEGIN; UPDATE {table} SET {change} WHERE id='{id}'; SELECT 'ready';\n");a.stdin.flush()
 assert a.stdout.readline().strip()=='ready'
 b=subprocess.Popen(args+['-c',settings+"SET application_name='remaining_parent_waiter'; "+call],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 try:
  wait_condition("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='remaining_parent_waiter' AND wait_event_type='Lock')",'RPC waits for parent row')
  a.stdin.write('COMMIT;\n\\q\n');a.stdin.flush();a.communicate(timeout=10)
  out,err=b.communicate(timeout=10)
  if (not before or existing_guard) and error:
   assert b.returncode!=0 and error in err,(out,err)
  else:assert b.returncode==0,(out,err)
  value=run(f"SELECT {'total' if table=='facturas' else 'tipo_cambio_usd'} FROM {table} WHERE id='{id}'").stdout.strip()
  expected=('116.00' if table=='facturas' else '19.25') if before and not existing_guard else ('77' if table=='facturas' else '18')
  assert float(value)==float(expected),(value,expected)
  label = 'EXISTING TRIGGER PROTECTION' if before and existing_guard else ('SYNTHETIC RISK REPRODUCED' if before else 'PASS')
  print(label+f': {table} {change} commits before waiting RPC; value={value}',flush=True)
 finally:
  if a.poll() is None:a.kill();a.communicate()
  if b.poll() is None:b.kill();b.communicate()

id='50000000-0000-0000-0000-000000000001'
blocked_after_parent_change('facturas','deleted_at=now()',f"SELECT recalc_factura_totales('{id}');")
blocked_after_parent_change('embarques','deleted_at=now()',f"SELECT actualizar_tc_embarque_dof('{id}','2026-10-13');",'Embarque no encontrado')
blocked_after_parent_change('embarques',"estado='Cancelado'",f"SELECT actualizar_tc_embarque_dof('{id}','2026-10-13');",'está cancelado')
# The real BEFORE UPDATE trigger already prevents late writes after closure.
blocked_after_parent_change('embarques',"estado='Cerrado'",f"SELECT actualizar_tc_embarque_dof('{id}','2026-10-13');",'Embarque cerrado' if before else 'está cerrado',existing_guard=True)
# Reverse order proves the lock exists BEFORE the DOF query/validation and protects
# the parent during it, rather than merely acquiring UPDATE's inevitable row lock.
for change in ['deleted_at=now()',"estado='Cancelado'"]:
 run(f"TRUNCATE embarques; INSERT INTO embarques(id,organization_id) VALUES ('{id}','20000000-0000-0000-0000-000000000001');")
 a=subprocess.Popen(args+['-c',settings+"SET application_name='remaining_parent_dof'; SET test.dof_delay='yes'; "+f"SELECT actualizar_tc_embarque_dof('{id}','2026-10-13');"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 b=None
 try:
  wait_condition("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='remaining_parent_dof' AND wait_event='PgSleep')",'RPC entered DOF fixture')
  b=subprocess.Popen(args+['-c',f"SET application_name='remaining_parent_delete'; UPDATE embarques SET {change} WHERE id='{id}';"],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
  if before:
   b.communicate(timeout=1);assert b.returncode==0
   assert a.poll() is None,'RPC should still be inside delayed DOF'
  else:
   wait_condition("SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name='remaining_parent_delete' AND wait_event_type='Lock')",'parent mutation waits during DOF')
  _,err=a.communicate(timeout=10);assert a.returncode==0,err
  if b.poll() is None:
   _,err=b.communicate(timeout=10);assert b.returncode==0,err
  print(('SYNTHETIC RISK REPRODUCED' if before else 'PASS')+f': during DOF, {change} '+('commits before rate update' if before else 'waits until rate update commits'),flush=True)
 finally:
  if a.poll() is None:a.kill();a.communicate()
  if b and b.poll() is None:b.kill();b.communicate()
print('Six concurrency scenarios complete.',flush=True)
