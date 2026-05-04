import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import logo from './assets/logo.png'
import qrBancolombia from './assets/QR-Bancolombia.jpeg'

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
  const [userRole, setUserRole] = useState(null); 
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
    const nombreLimpio = clienteNombre.trim();
    if (!nombreLimpio) return alert("❌ Escribe tu nombre primero");
    
    const perfilUsuario = perfiles.find(u => u.nombre.toLowerCase() === nombreLimpio.toLowerCase());
    if (!perfilUsuario) return alert("❌ Usuario no encontrado. Verifica tu nombre.");

    if (!fechaManual) {
      const pinIngresado = prompt(`🔐 Confirmar compra para ${perfilUsuario.nombre}. Ingresa tu PIN:`);
      if (pinIngresado !== perfilUsuario?.pin) return alert("🚫 PIN incorrecto");
    }

    if (producto.stock < cantidad) return alert("❌ No hay suficiente stock");

    const totalVenta = producto.precio * cantidad;
    const nombreProd = cantidad > 1 ? `${producto.nombre} (x${cantidad})` : producto.nombre;

    const fechaFinal = fechaManual 
      ? new Date(fechaManual).toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
      : new Date().toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });

    const { error: errorVenta } = await supabase.from('ventas').insert([
      { cliente: perfilUsuario.nombre, producto: nombreProd, precio: totalVenta, fecha: fechaFinal, pagado: false }
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
      const pin = prompt("🔐 Ingresa tu PIN de acceso:");
      const perfil = perfiles.find(u => u.pin === pin);
      
      if (pin === ADMIN_PASSWORD) {
        setUserRole('superadmin');
        setView('admin');
      } else if (perfil && (perfil.rol === 'superadmin' || perfil.rol === 'admin')) {
        setUserRole(perfil.rol);
        setView('admin');
      } else if (pin !== null) {
        alert("🚫 No tienes permisos de administrador.");
      }
    } else {
      setUserRole(null);
      setView('catalogo');
    }
  };

  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
      <div className="w-12 h-12 border-4 border-[#f989b7] border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="font-black text-[#f989b7] animate-pulse text-xl uppercase tracking-tighter">Sincronizando Tienda...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <nav className="bg-[#f989b7] text-white p-6 sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto max-w-5xl flex flex-col items-center gap-4">
          
          <div 
            onClick={manejarAccesoAdmin}
            className="flex flex-col items-center cursor-pointer select-none active:scale-95 transition-transform"
          >
            <img src={logo} alt="Logo" className="h-20 w-auto object-contain mb-2" />
            <h1 className="font-black text-[28px] tracking-tighter italic uppercase leading-none">
              LA MARIKOTIENDA 
            </h1>
          </div>

          {view === 'admin' && (
            <button 
              onClick={manejarAccesoAdmin} 
              className="bg-white text-[#f969b3] px-6 py-2 rounded-xl font-bold text-xs transition-all uppercase italic shadow-md hover:bg-slate-100"
            >
              VOLVER AL MENÚ
            </button>
          )}
        </div>
      </nav>

      <main className="container mx-auto p-4 max-w-5xl">
        {view === 'catalogo' ? (
          <VistaCatalogo productos={productos} registrarVenta={registrarVenta} ventas={ventas} />
        ) : (
          userRole && <VistaAdmin role={userRole} ventas={ventas} productos={productos} perfiles={perfiles} registrarVenta={registrarVenta} refresh={fetchDatos} />
        )}
      </main>
    </div>
  )
}

// ... (Mantén el resto del código de App igual hasta VistaCatalogo)

function VistaCatalogo({ productos, registrarVenta, ventas }) {
  const [user, setUser] = useState("");
  const [search, setSearch] = useState("");
  const [mostrarPagos, setMostrarPagos] = useState(false); // Estado para alternar vistas
  const [qrZoom, setQrZoom] = useState(false); // <--- Nuevo estado para el zoom
  
  const deudaPersonal = ventas.filter(v => v.cliente.toLowerCase() === user.toLowerCase() && !v.pagado).reduce((acc, v) => acc + v.precio, 0);
  
  const itemsFiltrados = productos.filter(p => 
    p.nombre.toLowerCase().includes(search.toLowerCase())
  );

  const conStock = itemsFiltrados.filter(p => p.stock > 0);
  const sinStock = itemsFiltrados.filter(p => p.stock <= 0);

  // Función para copiar al portapapeles
  const copiar = (texto) => {
    navigator.clipboard.writeText(texto);
    alert(`✅ Copiado: ${texto}`);
  };

  return (
    <div className="animate-in fade-in duration-500 pb-20">
      {/* 1. INPUT DE USUARIO (WHOS ARE YOU?) */}
      <div className="bg-white p-6 rounded-[2.5rem] shadow-xl border border-slate-100 mb-6 flex flex-col items-center gap-4">
        <input 
          type="text"
          placeholder="who are you?..."
          className="w-full max-w-md bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl font-black text-xl text-center outline-none focus:border-[#f989b7] transition-all uppercase placeholder:text-slate-300"
          value={user}
          onChange={(e) => setUser(e.target.value)}
        />
        {user.length > 2 && (
          <div className="flex flex-col items-center gap-3">
            <div className="bg-[#f989b7] text-white px-8 py-3 rounded-full font-black text-sm uppercase italic shadow-lg">
              💰 Saldo: {fM(deudaPersonal)}
            </div>
            <button 
              onClick={() => setMostrarPagos(!mostrarPagos)}
              className={`text-[10px] font-black uppercase tracking-widest transition-colors ${mostrarPagos ? 'text-red-400' : 'text-slate-400 hover:text-[#f989b7]'}`}
            >
              {mostrarPagos ? '[ VOLVER A SNACKS ]' : '[ MEDIOS DE PAGO ]'}
            </button>
          </div>
        )}
      </div>

      {!mostrarPagos ? (
        <>
          {/* 2. BUSCADOR DE PRODUCTOS */}
          <div className="mb-8 px-2">
            <input 
              type="text"
              placeholder="🔍 Buscar snack..."
              className="w-full bg-white/50 border-b-2 border-slate-200 p-3 outline-none font-bold text-slate-500 focus:border-[#f989b7] transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-6 ml-2 italic">Menú Principal</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-12">
            {conStock.map(p => <CardProducto key={p.id} producto={p} user={user} registrarVenta={registrarVenta} />)}
          </div>

          {sinStock.length > 0 && (
            <div className="opacity-50">
              <div className="relative py-8 flex justify-center items-center">
                 <span className="bg-slate-50 px-4 text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Agotados recientemente</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {sinStock.map(p => (
                  <div key={p.id} className="bg-white p-4 rounded-[1.5rem] flex flex-col items-center grayscale border border-slate-100">
                    <span className="text-3xl mb-1">{p.emoji || "🍭"}</span>
                    <p className="text-[9px] font-black uppercase text-slate-400">{p.nombre}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* --- SECCIÓN DE MEDIOS DE PAGO --- */
        <div className="animate-in zoom-in-95 duration-300">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-100">
            <h2 className="text-2xl font-black text-slate-800 uppercase italic mb-8 text-center tracking-tighter">¿Cómo pagar mi deuda?</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Bancolombia */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-[#fd0] rounded-xl mb-4 flex items-center justify-center font-black text-slate-900 shadow-sm">B</div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Ahorros Bancolombia</p>
                <p className="font-black text-slate-700 text-lg mb-4">912 118 628 70</p>
                <button onClick={() => copiar("91211862870")} className="bg-white px-4 py-2 rounded-xl text-[10px] font-black shadow-sm hover:bg-[#f989b7] hover:text-white transition-all uppercase">Copiar número</button>
              </div>

              {/* Nequi */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-[#331c4d] rounded-xl mb-4 flex items-center justify-center text-white font-black">N</div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Nequi</p>
                <p className="font-black text-slate-700 text-lg mb-4">301 760 6255</p>
                <button onClick={() => copiar("3017606255")} className="bg-white px-4 py-2 rounded-xl text-[10px] font-black shadow-sm hover:bg-[#f989b7] hover:text-white transition-all uppercase">Copiar número</button>
              </div>

              {/* Bre-B (Transfiya) */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-[#00cfba] rounded-xl mb-4 flex items-center justify-center text-white font-black italic">Bre-B</div>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Llave Bre-B</p>
                <p className="font-black text-slate-700 text-lg mb-4">@garces812</p>
                <button onClick={() => copiar("@garces812")} className="bg-white px-4 py-2 rounded-xl text-[10px] font-black shadow-sm hover:bg-[#f989b7] hover:text-white transition-all uppercase">Copiar llave</button>
              </div>

              {/* QR Bancolombia */}
              <div className="bg-[#f989b7]/10 p-6 rounded-3xl border-2 border-dashed border-[#f989b7] flex flex-col items-center text-center">
                <p className="text-[10px] font-black text-[#f989b7] uppercase mb-4 italic">Escanea mi QR</p>
                
                {/* El contenedor ahora tiene cursor pointer y trigger del zoom */}
                <div 
                  onClick={() => setQrZoom(true)}
                  className="bg-white p-2 rounded-2xl shadow-md mb-4 aspect-square w-32 flex items-center justify-center overflow-hidden cursor-zoom-in hover:scale-105 transition-transform"
                >
                  <img 
                    src={qrBancolombia} 
                    alt="QR Bancolombia" 
                    className="w-full h-full object-contain" 
                  />
                </div>
                
                <p className="text-[9px] font-bold text-slate-400 px-4">¡Toca el código para ampliarlo!</p>
              </div>

{/* --- COMPONENTE LIGHTBOX --- */}
{qrZoom && (
  <div 
    className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300"
    onClick={() => setQrZoom(false)}
  >
    <div className="relative max-w-sm w-full bg-white p-4 rounded-[2.5rem] shadow-2xl animate-in zoom-in-95 duration-300">
      <button 
        className="absolute -top-12 right-0 text-white font-black text-xl uppercase tracking-tighter"
        onClick={() => setQrZoom(false)}
      >
        Cerrar ✕
      </button>
      <img 
        src={qrBancolombia} 
        alt="QR Ampliado" 
        className="w-full h-auto rounded-2xl shadow-inner"
      />
      <p className="text-center mt-4 font-black text-[#f989b7] italic uppercase text-xs">
        Escanea o toma pantallazo
      </p>
    </div>
  </div>
)}

            </div>

            {/* Botón WhatsApp */}
            <div className="mt-10 pt-8 border-t border-slate-100">
              <a 
                href="https://wa.me/573017606255?text=Hola!%20Acabo%20de%20realizar%20un%20pago%20en%20La%20Marikotienda" 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-center gap-3 w-full bg-[#25D366] text-white p-5 rounded-[2rem] font-black uppercase italic shadow-lg hover:bg-[#128C7E] transition-all active:scale-95"
              >
                <span>Reportar pago por WhatsApp</span>
                <span className="text-xl">💬</span>
              </a>
              <p className="text-center text-[9px] font-bold text-slate-400 mt-4 uppercase tracking-tighter">Tu pago será validado por Juan Esteban Garcés Medina</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ... (El resto del código hacia abajo sigue igual)

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
        <p className="text-[#f989b7] font-black text-2xl mb-3">{fM(p.precio)}</p>
        <div className="flex items-center justify-center gap-4 mb-4 bg-slate-50 rounded-xl p-1">
          <button onClick={() => setCant(Math.max(1, cant - 1))} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm font-bold text-[#f989b7] hover:bg-[#f989b7] hover:text-white">-</button>
          <span className="font-black text-slate-700 w-4">{cant}</span>
          <button onClick={() => setCant(Math.min(p.stock, cant + 1))} className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm font-bold text-[#f989b7] hover:bg-[#f989b7] hover:text-white">+</button>
        </div>
        <button onClick={() => { registrarVenta(user, p, cant); setCant(1); }} className="w-full py-4 rounded-2xl text-white font-black text-xs transition-all bg-[#f969b3] hover:bg-[#f949b3] shadow-lg active:scale-95 uppercase tracking-tighter">
          {`COMPRAR ${cant > 1 ? `x${cant}` : ''}`}
        </button>
      </div>
    </div>
  );
}

function VistaAdmin({ role, ventas, productos, perfiles, registrarVenta, refresh }) {
  const [form, setForm] = useState({ id: null, nombre: '', precio: '', stock: '', emoji: '', imagen: '' });
  const [userForm, setUserForm] = useState({ nombre: '', pin: '', rol: 'comprador' });
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

  const guardarPerfil = async (e) => {
    e.preventDefault();
    const finalRol = role === 'superadmin' ? userForm.rol : 'comprador';
    const { error } = await supabase.from('perfiles').insert([{ ...userForm, rol: finalRol }]);
    if (!error) { setUserForm({ nombre: '', pin: '', rol: 'comprador' }); refresh(); alert("✅ Usuario creado"); }
  };

  const guardarProducto = async (e) => {
    e.preventDefault();
    const data = { nombre: form.nombre, precio: Number(form.precio), stock: Number(form.stock), emoji: form.emoji, imagen: form.imagen };
    if (form.id) {
      await supabase.from('productos').update(data).eq('id', form.id);
      alert("✅ Producto actualizado");
    } else {
      await supabase.from('productos').insert([data]);
      alert("✅ Producto creado");
    }
    setForm({ id: null, nombre: '', precio: '', stock: '', emoji: '', imagen: '' });
    refresh();
  };

  return (
    <div className="space-y-6 pb-20 animate-in slide-in-from-bottom-4 duration-500">
      
      <style>{`
        @media print {
          nav, .no-print, button, form, .filtros-admin { display: none !important; }
          body { background: white !important; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print-area { position: absolute; top: 0; left: 0; width: 100%; padding: 0 !important; }
          .factura-container { border: 1.5px solid #f989b7 !important; border-radius: 20px !important; padding: 20px !important; margin: 5px !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th { background-color: #f989b7 !important; color: white !important; padding: 8px !important; font-size: 9px !important; text-transform: uppercase; }
          td { border-bottom: 1px solid #fee2ed !important; padding: 6px 8px !important; color: #334155 !important; font-size: 10px !important; }
          .logo-img { height: 50px !important; }
          .total-compacto { border-left: 4px solid #f989b7 !important; background: #fff5f8 !important; padding: 10px 20px !important; }
        }
      `}</style>

      {/* GESTIÓN DE USUARIOS - Jerarquía de Roles y PIN Numérico */}
      <div className="bg-[#f989b7] p-8 rounded-[2.5rem] shadow-sm text-white">
        <h2 className="text-xl font-black uppercase mb-6 italic">👥 Usuarios Registrados</h2>
        
        {/* Formulario para añadir nuevos usuarios */}
        <form onSubmit={guardarPerfil} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <input 
            placeholder="Nombre" 
            className="p-4 rounded-2xl bg-white text-slate-800 font-bold outline-none" 
            value={userForm.nombre} 
            onChange={e => setUserForm({...userForm, nombre: e.target.value})} 
            required 
          />
          
          <input 
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="PIN (4 núm)" 
            className="p-4 rounded-2xl bg-white text-slate-800 font-bold outline-none text-center" 
            value={userForm.pin} 
            onChange={e => {
              const valor = e.target.value.replace(/\D/g, '');
              setUserForm({...userForm, pin: valor});
            }} 
            required 
            maxLength={4} 
          />

          {/* Selector de Rol Dinámico */}
          <select 
            className="p-4 rounded-2xl bg-white text-slate-800 font-bold outline-none" 
            value={userForm.rol} 
            onChange={e => setUserForm({...userForm, rol: e.target.value})}
          >
            <option value="comprador">Comprador</option>
            {/* Solo el Superadmin puede ver y asignar estos roles */}
            {role === 'superadmin' && (
              <>
                <option value="admin">Admin</option>
                <option value="superadmin">SuperAdmin</option>
              </>
            )}
          </select>

          <button className="bg-slate-900 text-white font-black rounded-2xl uppercase text-xs hover:bg-black transition-colors">
            Añadir
          </button>
        </form>
        
        {/* Lista de usuarios con opción de eliminar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {perfiles.map(u => (
            <div key={u.id} className="bg-white/20 p-3 rounded-xl text-xs font-bold flex justify-between items-start group relative">
              <div>
                <span className="block truncate pr-4">{u.nombre.toUpperCase()}</span>
                <span className="opacity-60 text-[10px]">
                  {role === 'superadmin' ? `PIN: ${u.pin}` : 'PIN: ****'}
                </span>
                <span className="block text-[8px] opacity-50 mt-1 uppercase italic">{u.rol}</span>
              </div>

              {role === 'superadmin' && (
                <button 
                  onClick={async () => {
                    if (u.rol === 'superadmin') return alert("🚫 No puedes eliminar a un Superadmin.");
                    if (confirm(`¿Estás seguro de eliminar a ${u.nombre}?`)) {
                      const { error } = await supabase.from('perfiles').delete().eq('id', u.id);
                      if (error) alert("❌ Error: " + error.message);
                      else refresh();
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 bg-red-500 hover:bg-red-700 text-white w-6 h-6 rounded-lg flex items-center justify-center transition-all shadow-sm absolute top-2 right-2"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 2. FACTURA COMPACTA (SE IMPRIME) */}
      <div className="print-area factura-container bg-white p-6 rounded-[2.5rem] shadow-sm border border-slate-100">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Logo" className="logo-img h-14 w-auto" />
            <div>
              <h1 className="text-xl font-black italic text-[#f989b7] leading-none tracking-tighter">LA MARIKOTIENDA</h1>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">Recibo de Consumo</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-700">{new Date().toLocaleDateString('es-CO')}</p>
          </div>
        </div>

        <div className="total-compacto flex justify-between items-center rounded-xl mb-4 border border-pink-50 shadow-sm px-6 py-4">
          <div>
            <p className="text-[9px] font-black text-[#f989b7] uppercase tracking-tighter">Estado de cuenta de:</p>
            <h2 className="text-xl font-black text-slate-800 uppercase italic leading-none">{filtroNombre || "General"}</h2>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Total:</p>
            <p className="text-2xl font-black text-[#f989b7] leading-none">{fM(totalF)}</p>
          </div>
        </div>

        <div className="no-print filtros-admin mb-4">
          <input 
            placeholder="🔍 Escribe nombre para buscar factura..." 
            className="w-full bg-slate-50 border-2 border-slate-100 p-4 rounded-2xl outline-none font-bold text-[#f989b7] focus:border-[#f989b7] transition-all" 
            value={filtroNombre} onChange={(e) => setFiltroNombre(e.target.value)} 
          />
        </div>

        <div className="max-h-80 overflow-y-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#f989b7] text-white">
                <th className="rounded-l-lg p-2">Fecha</th>
                <th className="p-2">Snack</th>
                <th className="text-right p-2">Precio</th>
                {role === 'superadmin' && <th className="rounded-r-lg p-2 no-print">Acción</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-50">
              {ventasFiltradas.map(v => (
                <tr key={v.id}>
                  <td className="py-2 px-2 text-[9px] font-bold text-slate-400">{v.fecha}</td>
                  <td className="py-2 px-2 font-bold text-slate-700 uppercase">{v.producto}</td>
                  <td className="py-2 px-2 text-right font-black text-slate-800">{fM(v.precio)}</td>
                  {role === 'superadmin' && (
                    <td className="py-2 px-2 text-right no-print">
                        <button 
                            onClick={async () => { if(confirm("¿Eliminar esta venta?")) { await supabase.from('ventas').delete().eq('id', v.id); refresh(); }}}
                            className="text-red-400 hover:text-red-600 font-bold text-[10px]"
                        >✕ Borrar</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="no-print mt-6 flex gap-3">
          <button onClick={() => window.print()} className="bg-[#f989b7] text-white px-6 py-3 rounded-xl font-black uppercase italic shadow-md hover:bg-[#f969b3] flex-1 text-xs">🖨️ PDF / Imprimir</button>
          {role === 'superadmin' && filtroNombre && totalF > 0 && (
            <button onClick={async () => { if(confirm(`¿Confirmar pago?`)) { await supabase.from('ventas').update({ pagado: true }).in('id', ventasFiltradas.map(v=>v.id)); refresh(); } }} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black uppercase italic shadow-md hover:bg-black flex-1 text-xs">✅ Marcar como Pagado</button>
          )}
        </div>
      </div>

      {/* 3. CARGA MANUAL */}
      <div className="no-print p-6 rounded-[2.5rem] shadow-sm border border-slate-100 text-white">
        <h2 className="font-black uppercase italic mb-4 text-pink-400">🛒 Carga Manual Directa</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select className="p-3 rounded-xl font-bold text-sm outline-none text-slate-800" value={manualUser} onChange={e => setManualUser(e.target.value)}>
            <option value="">¿Quién compró?</option>
            {perfiles.map(u => <option key={u.id} value={u.nombre}>{u.nombre}</option>)}
          </select>
          <select className="p-3 rounded-xl font-bold text-sm outline-none text-slate-800" value={manualProdId} onChange={e => setManualProdId(e.target.value)}>
            <option value="">¿Qué snack?</option>
            {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <input type="number" className="p-3 rounded-xl font-bold outline-none text-center text-slate-800" value={manualCant} onChange={e => setManualCant(Number(e.target.value))} />
          <button onClick={() => { const p = productos.find(x => x.id === Number(manualProdId)); if (manualUser && p) registrarVenta(manualUser, p, manualCant, manualFecha); }} className="bg-[#f989b7] text-white font-black rounded-xl uppercase text-[10px] hover:bg-[#f969b3] transition-all">Registrar Venta</button>
        </div>
      </div>

      {/* 4. GESTIÓN DE SNACKS */}
      <div className="no-print bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <h2 className="text-xl font-black mb-6 uppercase text-[#f989b7] italic">
          {form.id ? '⚡ Editando Producto' : '➕ Nuevo Producto'}
        </h2>
        
        <form onSubmit={guardarProducto} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <input placeholder="Nombre del Snack" className="bg-slate-50 p-4 rounded-xl font-bold outline-none border-2 border-transparent focus:border-[#f989b7]" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} required />
          <input type="number" placeholder="Precio ($)" className="bg-slate-50 p-4 rounded-xl font-bold outline-none border-2 border-transparent focus:border-[#f989b7]" value={form.precio} onChange={e => setForm({...form, precio: e.target.value})} required />
          <input type="number" placeholder="Stock Inicial" className="bg-slate-50 p-4 rounded-xl font-bold outline-none border-2 border-transparent focus:border-[#f989b7]" value={form.stock} onChange={e => setForm({...form, stock: e.target.value})} required />
          <input placeholder="Emoji (ej: 🍭)" className="bg-slate-50 p-4 rounded-xl text-center text-2xl outline-none" value={form.emoji} onChange={e => setForm({...form, emoji: e.target.value})} />
          <input placeholder="URL Imagen (opcional)" className="bg-slate-50 p-4 rounded-xl outline-none col-span-1 md:col-span-2" value={form.imagen} onChange={e => setForm({...form, imagen: e.target.value})} />
          
          <div className="col-span-full flex gap-2">
            <button className="bg-[#f989b7] p-4 rounded-xl font-black text-white flex-1 shadow-md uppercase hover:bg-[#f969b3] transition-all">
              {form.id ? 'Actualizar Cambios' : 'Guardar en Catálogo'}
            </button>
            {form.id && (
              <button type="button" onClick={() => setForm({ id: null, nombre: '', precio: '', stock: '', emoji: '', imagen: '' })} className="bg-slate-100 p-4 rounded-xl font-black text-slate-400 uppercase">Cancelar</button>
            )}
          </div>
        </form>

        <div className="border-t border-slate-50 pt-8">
          <input 
            placeholder="🔍 Buscar snack para editar o borrar..." 
            className="w-full bg-slate-50 p-4 rounded-2xl mb-6 outline-none font-bold text-slate-600 border border-slate-100 focus:border-[#f989b7]" 
            onChange={e => setBusquedaInventario(e.target.value)} 
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {productos.filter(p => p.nombre.toLowerCase().includes(busquedaInventario.toLowerCase())).map(p => (
              <div key={p.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-transparent hover:border-[#f989b7] transition-all group">
                <div className="flex items-center gap-3">
                  <span className="text-2xl bg-white w-10 h-10 flex items-center justify-center rounded-lg shadow-sm">{p.emoji || "🍬"}</span>
                  <div>
                    <p className="font-black text-slate-800 text-xs uppercase">{p.nombre}</p>
                    <p className="text-[10px] font-bold text-[#f989b7]">{fM(p.precio)} — Stock: {p.stock}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setForm(p); window.scrollTo({top: 1000, behavior:'smooth'}) }} className="bg-white p-2 px-4 rounded-lg text-[#f989b7] font-black text-[10px] shadow-sm hover:bg-[#f989b7] hover:text-white transition-all uppercase">Editar</button>
                  {role === 'superadmin' && (
                    <button onClick={async () => { if(confirm("¿Eliminar snack?")) { await supabase.from('productos').delete().eq('id', p.id); refresh(); } }} className="bg-red-50 p-2 px-3 rounded-lg text-red-400 hover:bg-red-500 hover:text-white transition-all text-[10px]">✕</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;