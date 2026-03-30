import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

// --- CONFIGURACIÓN ---
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY;
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const fM = (v) => new Intl.NumberFormat('es-CO', { 
  style: 'currency', 
  currency: 'COP', 
  minimumFractionDigits: 0 
}).format(v);

function App() {
  const [view, setView] = useState('catalogo');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [ventas, setVentas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [perfiles, setPerfiles] = useState([]); 
  const [loading, setLoading] = useState(true);

  const fetchDatos = async () => {
    try {
      const { data: p } = await supabase.from('productos').select('*').order('nombre');
      const { data: v } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
      const { data: u } = await supabase.from('perfiles').select('*').order('nombre');
      
      if (p) setProductos(p);
      if (v) setVentas(v);
      if (u) setPerfiles(u);
    } catch (err) {
      console.error("Error al sincronizar:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDatos(); }, []);

  const registrarVenta = async (clienteNombre, producto, cantidad = 1, fechaManual = null) => {
    if (!clienteNombre) return alert("❌ Selecciona tu nombre primero");
    const perfilUsuario = perfiles.find(u => u.nombre === clienteNombre);

    if (!fechaManual) {
      const pinIngresado = prompt(`🔐 Confirmar compra para ${clienteNombre}. Ingresa tu PIN:`);
      if (pinIngresado !== perfilUsuario?.pin) return alert("🚫 PIN incorrecto");
    }

    if (producto.stock < cantidad) return alert("❌ No hay suficiente stock");

    const totalVenta = producto.precio * cantidad;
    const nombreProd = cantidad > 1 ? `${producto.nombre} (x${cantidad})` : producto.nombre;

    const fechaFinal = fechaManual 
      ? new Date(fechaManual).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
      : new Date().toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });

    const { error: errorVenta } = await supabase.from('ventas').insert([
      { cliente: clienteNombre, producto: nombreProd, precio: totalVenta, fecha: fechaFinal, pagado: false }
    ]);

    const { error: errorStock } = await supabase.from('productos')
      .update({ stock: producto.stock - cantidad })
      .eq('id', producto.id);

    if (!errorVenta && !errorStock) {
      alert(`✅ Registrado: ${nombreProd}`);
      fetchDatos();
    }
  };

  const manejarAccesoAdmin = () => {
    if (view === 'catalogo') {
      const pass = prompt("🔐 PIN de Admin:");
      if (pass === ADMIN_PASSWORD) { setIsAuthenticated(true); setView('admin'); } 
      else { alert("🚫 Incorrecto"); }
    } else { setIsAuthenticated(false); setView('catalogo'); }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="font-black text-indigo-600 animate-pulse text-xl uppercase tracking-tighter">Sincronizando Tienda...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <nav className="bg-indigo-600 text-white p-4 sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto max-w-5xl flex justify-between items-center">
          <h1 className="font-black text-xl tracking-tighter italic uppercase">TIENDA DE LA CONFIANZA</h1>
          <button onClick={manejarAccesoAdmin} className="bg-indigo-500 hover:bg-white hover:text-indigo-600 px-4 py-2 rounded-xl font-bold text-xs transition-all uppercase italic">
            {view === 'catalogo' ? 'ADMIN PANEL' : 'VOLVER AL MENÚ'}
          </button>
        </div>
      </nav>
      <main className="container mx-auto p-4 max-w-5xl">
        {view === 'catalogo' ? (
          <VistaCatalogo productos={productos} clientes={perfiles.map(u => u.nombre)} registrarVenta={registrarVenta} ventas={ventas} />
        ) : (
          isAuthenticated && <VistaAdmin ventas={ventas} productos={productos} perfiles={perfiles} registrarVenta={registrarVenta} refresh={fetchDatos} />
        )}
      </main>
    </div>
  )
}

function VistaCatalogo({ productos, clientes, registrarVenta, ventas }) {
  const [user, setUser] = useState("");
  const deudaPersonal = ventas.filter(v => v.cliente === user && !v.pagado).reduce((acc, v) => acc + v.precio, 0);
  const conStock = productos.filter(p => p.stock > 0);
  const sinStock = productos.filter(p => p.stock <= 0);

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 mb-8 mt-4 flex flex-col items-center gap-4 text-center">
        <select className="w-full max-w-lg bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-bold text-lg text-center outline-none focus:border-indigo-300 transition-all appearance-none cursor-pointer" value={user} onChange={(e) => setUser(e.target.value)}>
          <option value="">¿Quién eres?</option>
          {clientes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {user && <div className="bg-indigo-50 text-indigo-600 px-6 py-2 rounded-full font-black text-sm uppercase italic animate-bounce">💰 Tu deuda actual: {fM(deudaPersonal)}</div>}
      </div>
      <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-4 ml-2">Snacks Disponibles</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-12">
        {conStock.map(p => <CardProducto key={p.id} producto={p} user={user} registrarVenta={registrarVenta} />)}
      </div>
      {sinStock.length > 0 && (
        <>
          <div className="relative py-8"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-200"></span></div><div className="relative flex justify-center"><span className="bg-slate-50 px-4 text-xs font-black text-indigo-300 uppercase tracking-widest">Pronto Volveremos</span></div></div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 opacity-60">
            {sinStock.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-[1.5rem] border border-slate-100 flex flex-col items-center grayscale shadow-sm">
                <span className="text-3xl mb-2">{p.emoji || "🍭"}</span>
                <p className="text-[10px] font-black uppercase text-slate-500 text-center">{p.nombre}</p>
                <div className="mt-2 bg-slate-100 text-[8px] font-bold px-3 py-1 rounded-full text-slate-400 uppercase">Agotado</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function CardProducto({ producto: p, user, registrarVenta }) {
  const [cant, setCant] = useState(1);
  return (
    <div className="bg-white p-2 rounded-[2rem] shadow-sm hover:shadow-2xl transition-all border border-slate-50 relative overflow-hidden group">
      <div className={`absolute top-4 right-4 px-3 py-1 rounded-full font-black text-[10px] shadow-sm z-10 ${p.stock > 5 ? 'bg-white text-slate-400' : 'bg-orange-500 text-white animate-pulse'}`}>{p.stock} DISP.</div>
      <div className="bg-slate-50 rounded-[1.8rem] aspect-square flex items-center justify-center overflow-hidden transition-transform group-hover:scale-110">
        {p.imagen ? <img src={p.imagen} className="w-full h-full object-cover" /> : <span className="text-5xl">{p.emoji || "🍭"}</span>}
      </div>
      <div className="p-4 text-center">
        <h3 className="font-black text-slate-700 text-xs uppercase truncate mb-1">{p.nombre}</h3>
        <p className="text-indigo-600 font-black text-2xl mb-3">{fM(p.precio)}</p>
        <div className="flex items-center justify-center gap-4 mb-4 bg-slate-50 rounded-xl p-1">
          <button onClick={() => setCant(Math.max(1, cant - 1))} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm font-bold text-indigo-600 hover:bg-indigo-100">-</button>
          <span className="font-black text-slate-700 w-4">{cant}</span>
          <button onClick={() => setCant(Math.min(p.stock, cant + 1))} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm font-bold text-indigo-600 hover:bg-indigo-100">+</button>
        </div>
        <button onClick={() => { registrarVenta(user, p, cant); setCant(1); }} className="w-full py-4 rounded-2xl text-white font-black text-xs transition-all bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-100 active:scale-95 uppercase tracking-tighter">
          {`COMPRAR ${cant > 1 ? `x${cant}` : ''}`}
        </button>
      </div>
    </div>
  );
}

function VistaAdmin({ ventas, productos, perfiles, registrarVenta, refresh }) {
  const [form, setForm] = useState({ id: null, nombre: '', precio: '', stock: '', emoji: '', imagen: '' });
  const [userForm, setUserForm] = useState({ nombre: '', pin: '' });
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroProducto, setFiltroProducto] = useState("");
  const [busquedaInventario, setBusquedaInventario] = useState("");
  const [manualUser, setManualUser] = useState("");
  const [manualProdId, setManualProdId] = useState("");
  const [manualCant, setManualCant] = useState(1);
  const [manualFecha, setManualFecha] = useState(new Date().toISOString().slice(0, 16));

  const ventasFiltradas = ventas.filter(v => {
    const coincideNombre = v.cliente.toLowerCase().includes(filtroNombre.toLowerCase());
    const coincideProducto = v.producto.toLowerCase().includes(filtroProducto.toLowerCase());
    return coincideNombre && coincideProducto && !v.pagado;
  });

  const totalF = ventasFiltradas.reduce((acc, v) => acc + v.precio, 0);

  // --- FUNCIÓN DE IMPRESIÓN ---
  const imprimirReporte = () => {
    const win = window.open('', '_blank');
    const hoy = new Date().toLocaleDateString();
    const rows = ventasFiltradas.map(v => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${v.fecha}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${v.cliente}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${v.producto}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">${fM(v.precio)}</td>
      </tr>
    `).join('');

    win.document.write(`
      <html>
        <head>
          <title>Reporte de Ventas</title>
          <style>
            body { font-family: sans-serif; color: #333; padding: 40px; }
            .header { border-bottom: 4px solid #4f46e5; padding-bottom: 10px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; }
            th { text-align: left; background: #f8fafc; padding: 10px; font-size: 12px; text-transform: uppercase; }
            .total { text-align: right; font-size: 24px; font-weight: bold; margin-top: 20px; color: #4f46e5; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>TIENDA DE LA CONFIANZA</h1>
            <p>Reporte generado el: ${hoy}</p>
            <p>Filtro Cliente: <strong>${filtroNombre || 'Todos'}</strong></p>
          </div>
          <table>
            <thead><tr><th>Fecha</th><th>Cliente</th><th>Producto</th><th style="text-align:right">Precio</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
          <div class="total">TOTAL PENDIENTE: ${fM(totalF)}</div>
        </body>
      </html>
    `);
    win.document.close();
    win.print();
  };

  const guardarPerfil = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('perfiles').insert([userForm]);
    if (!error) { setUserForm({ nombre: '', pin: '' }); refresh(); }
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    const data = { nombre: form.nombre, precio: Number(form.precio), stock: Number(form.stock), emoji: form.emoji, imagen: form.imagen };
    if (form.id) await supabase.from('productos').update(data).eq('id', form.id);
    else await supabase.from('productos').insert([data]);
    setForm({ id: null, nombre: '', precio: '', stock: '', emoji: '', imagen: '' });
    refresh();
  };

  return (
    <div className="space-y-8 pb-20 animate-in slide-in-from-bottom-4 duration-500">
      
      {/* SECCIÓN 1: GESTIÓN DE USUARIOS */}
      <div className="bg-indigo-50 p-8 rounded-[2.5rem] border-2 border-indigo-100 shadow-sm">
        <h2 className="text-xl font-black uppercase text-indigo-700 mb-6 italic tracking-tight">👥 Gestión de Usuarios</h2>
        <form onSubmit={guardarPerfil} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <input placeholder="Nombre completo" className="p-4 rounded-2xl bg-white font-bold outline-none border-2 border-transparent focus:border-indigo-300" value={userForm.nombre} onChange={e => setUserForm({...userForm, nombre: e.target.value})} required />
          <input placeholder="PIN" className="p-4 rounded-2xl bg-white font-bold outline-none border-2 border-transparent focus:border-indigo-300" value={userForm.pin} onChange={e => setUserForm({...userForm, pin: e.target.value})} required maxLength={4} />
          <button className="bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-800 transition-all uppercase text-xs shadow-lg">Registrar</button>
        </form>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {perfiles.map(u => (
            <div key={u.id} className="bg-white p-4 rounded-2xl shadow-sm flex justify-between items-center border border-indigo-100">
              <div><p className="font-black text-slate-800 text-xs">{u.nombre}</p><p className="text-[10px] font-mono text-indigo-500">PIN: {u.pin}</p></div>
              <button onClick={async () => { if(confirm(`¿Eliminar a ${u.nombre}?`)) { await supabase.from('perfiles').delete().eq('id', u.id); refresh(); } }} className="text-red-300 hover:text-red-600">✕</button>
            </div>
          ))}
        </div>
      </div>

      {/* SECCIÓN 2: CUENTAS POR COBRAR */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <h2 className="text-2xl font-black italic uppercase text-slate-800 tracking-tighter">Cuentas por Cobrar</h2>
          <div className="flex flex-wrap w-full md:w-auto gap-2">
            <input placeholder="Cliente..." className="bg-slate-50 border-2 p-3 rounded-2xl flex-1 md:w-48 outline-none font-bold text-sm" value={filtroNombre} onChange={(e) => setFiltroNombre(e.target.value)} />
            <input placeholder="Snack..." className="bg-slate-50 border-2 p-3 rounded-2xl flex-1 md:w-48 outline-none font-bold text-sm" value={filtroProducto} onChange={(e) => setFiltroProducto(e.target.value)} />
          </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[2rem] text-white mb-6 flex flex-col md:flex-row justify-between items-center gap-4 shadow-xl">
          <div>
            <p className="text-[10px] opacity-50 uppercase font-black tracking-widest text-indigo-300">Total Pendiente:</p>
            <p className="text-4xl font-black">{fM(totalF)}</p>
          </div>
          <div className="flex gap-2 w-full md:w-auto">
            <button onClick={imprimirReporte} className="bg-slate-700 p-4 rounded-2xl font-black text-xs hover:bg-slate-600 uppercase flex-1">Reporte 🖨️</button>
            {filtroNombre && totalF > 0 && !filtroProducto && (
              <button onClick={async () => { if(confirm(`¿Confirmas pago total de ${fM(totalF)} para ${filtroNombre}?`)) { await supabase.from('ventas').update({ pagado: true }).in('id', ventasFiltradas.map(v=>v.id)); refresh(); } }} className="bg-emerald-500 p-4 rounded-2xl font-black text-xs hover:bg-emerald-400 uppercase flex-1">Pagar Todo ✅</button>
            )}
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto pr-2 custom-scrollbar">
          <table className="w-full text-left text-xs border-separate border-spacing-y-2">
            <tbody>
              {ventasFiltradas.map(v => (
                <tr key={v.id} className="bg-slate-50 hover:bg-indigo-50 transition-colors group">
                  <td className="py-4 pl-4 rounded-l-2xl text-slate-400 font-bold">{v.fecha}</td>
                  <td className="py-4 font-black text-slate-700">{v.cliente}</td>
                  <td className="py-4 text-slate-500 italic">{v.producto}</td>
                  <td className="py-4 text-right font-black text-indigo-600">{fM(v.precio)}</td>
                  <td className="py-4 rounded-r-2xl text-center">
                    <button onClick={async () => { if(confirm("¿Eliminar registro?")) { await supabase.from('ventas').delete().eq('id', v.id); refresh(); } }} className="text-red-300 hover:text-red-500 px-3 opacity-0 group-hover:opacity-100">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* SECCIÓN 3: VENTA DIRECTA */}
      <div className="bg-indigo-600 p-8 rounded-[2.5rem] shadow-lg shadow-indigo-100">
        <h2 className="text-xl font-black mb-4 uppercase text-white italic">🛒 Carga Manual</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <select className="p-4 rounded-2xl bg-white font-bold text-sm outline-none" value={manualUser} onChange={e => setManualUser(e.target.value)}><option value="">¿Quién?</option>{perfiles.map(u => <option key={u.id} value={u.nombre}>{u.nombre}</option>)}</select>
          <select className="p-4 rounded-2xl bg-white font-bold text-sm outline-none" value={manualProdId} onChange={e => setManualProdId(e.target.value)}><option value="">¿Qué?</option>{productos.map(p => <option key={p.id} value={p.id}>{p.nombre} ({p.stock})</option>)}</select>
          <input type="number" className="p-4 rounded-2xl bg-white font-bold outline-none" value={manualCant} onChange={e => setManualCant(Number(e.target.value))} />
          <input type="datetime-local" className="p-4 rounded-2xl bg-white font-bold text-[10px] outline-none" value={manualFecha} onChange={e => setManualFecha(e.target.value)} />
          <button onClick={() => { const p = productos.find(x => x.id === Number(manualProdId)); if (manualUser && p) registrarVenta(manualUser, p, manualCant, manualFecha); }} className="bg-slate-900 text-white font-black rounded-2xl hover:bg-black transition-colors uppercase text-xs">Cargar</button>
        </div>
      </div>

      {/* SECCIÓN 4: INVENTARIO */}
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
        <h2 className="text-xl font-black mb-6 uppercase text-indigo-600 italic">{form.id ? '⚡ Editando' : '➕ Nuevo'}</h2>
        <form onSubmit={guardarProducto} className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-12">
          <input placeholder="Nombre" className="bg-slate-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-100" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} required />
          <input type="number" placeholder="Precio" className="bg-slate-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-100" value={form.precio} onChange={e => setForm({...form, precio: e.target.value})} required />
          <input type="number" placeholder="Stock" className="bg-slate-50 p-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-100" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} required />
          <input placeholder="Emoji" className="bg-slate-50 p-4 rounded-2xl text-center text-2xl outline-none" value={form.emoji} onChange={e => setForm({...form, emoji: e.target.value})} />
          <input placeholder="Imagen URL" className="bg-slate-50 p-4 rounded-2xl outline-none" value={form.imagen} onChange={e => setForm({...form, imagen: e.target.value})} />
          <button className="bg-indigo-600 p-4 rounded-2xl font-black text-white col-span-full hover:bg-indigo-700 uppercase transition-all shadow-lg shadow-indigo-100">{form.id ? 'Actualizar' : 'Guardar'}</button>
        </form>
        <div className="border-t border-slate-100 pt-8">
          <input placeholder="🔍 Buscar stock..." className="w-full bg-slate-50 p-4 rounded-2xl mb-6 outline-none border-2 border-slate-100 focus:border-indigo-200 font-bold" onChange={e => setBusquedaInventario(e.target.value)} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {productos.filter(p => p.nombre.toLowerCase().includes(busquedaInventario.toLowerCase())).map(p => (
              <div key={p.id} className={`flex items-center justify-between p-4 rounded-2xl border ${p.stock <= 0 ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-50 shadow-sm'}`}>
                <div className="flex items-center gap-3"><span className="text-3xl">{p.emoji || "🍬"}</span><div><p className="font-black text-slate-700 text-sm">{p.nombre}</p><p className={`text-[10px] font-bold uppercase ${p.stock <= 0 ? 'text-red-400' : 'text-slate-400'}`}>Stock: {p.stock}</p></div></div>
                <div className="flex gap-2">
                  <button onClick={() => {setForm(p); window.scrollTo({top: 1000, behavior:'smooth'})}} className="bg-indigo-50 p-2 px-4 rounded-xl text-indigo-600 font-black text-[10px] hover:bg-indigo-600 hover:text-white">EDITAR</button>
                  <button onClick={async () => { if(confirm("¿Eliminar?")) { await supabase.from('productos').delete().eq('id', p.id); refresh(); } }} className="bg-red-50 p-2 px-3 rounded-xl text-red-400 font-bold text-[10px] hover:bg-red-500 hover:text-white">✕</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App;