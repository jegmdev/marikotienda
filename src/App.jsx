import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import logo from './assets/logo.png'
import qrBancolombia from './assets/QR-Bancolombia.jpeg'
import './App.css';

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
      // Traemos productos y TODAS sus existencias vinculadas
      const { data: p, error: errorP } = await supabase
        .from('productos')
        .select(`
    id,
    nombre,
    precio,
    emoji,
    imagen_url: '',
    existencias (
      cantidad,
      ubicacion_id
    )
  `)
        .order('nombre');

      if (errorP) throw errorP;

      if (p) {
        const productosProcesados = p.map(prod => {
          // Buscamos las existencias usando el ID o el Nombre (por seguridad usamos ambos)
          const eTienda = prod.existencias?.find(e => e.ubicacion_id === 1 || e.sucursales?.nombre === 'Tienda');
          const eB1 = prod.existencias?.find(e => e.ubicacion_id === 2 || e.sucursales?.nombre === 'Bodega Yuyii');
          const eB2 = prod.existencias?.find(e => e.ubicacion_id === 3 || e.sucursales?.nombre === 'Bodega Teban');

          const stockTienda = eTienda?.cantidad || 0;
          const stockB1 = eB1?.cantidad || 0;
          const stockB2 = eB2?.cantidad || 0;

          return {
            ...prod,
            stockTienda,
            stockB1,
            stockB2,
            stock: stockTienda, // Para el catálogo de clientes
            stockGeneral: stockTienda + stockB1 + stockB2
          };
        });
        setProductos(productosProcesados);
      }

      // ... (resto del código para ventas y perfiles)
      const { data: v } = await supabase.from('ventas').select('*').order('created_at', { ascending: false });
      const { data: u } = await supabase.from('perfiles').select('*').order('nombre');
      if (v) setVentas(v);
      if (u) setPerfiles(u);

    } catch (err) {
      console.error("Error detallado:", err);
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
                href="https://wa.me/573017606255?text=Hola!%20Acabo%20de%20realizar%20un%20pago%20en%20La%20Marikotienda%20mi%20usuario%20es:%20(Escribe%20tu%20usuario%20aquí%20para%20borrar%20tu%20deuda)"
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

function VistaAdmin({ role, ventas, productos, perfiles, refresh }) {
  // --- ESTADOS PARA GESTIÓN DE USUARIOS ---
  const [userForm, setUserForm] = useState({ nombre: '', pin: '', rol: 'comprador' });
  const [editandoId, setEditandoId] = useState(null);
  const [tempUser, setTempUser] = useState({ nombre: '', pin: '' });

  // --- ESTADOS PARA NUEVO PRODUCTO ---
  const [nuevoProd, setNuevoProd] = useState({ nombre: '', precio: '', emoji: '', stockInicial: 0 });

  // --- ESTADOS PARA BODEGAS E INVENTARIO ---
  const [vistaStock, setVistaStock] = useState("General");
  const [sucursalDestino, setSucursalDestino] = useState("Tienda");
  const [origenStock, setOrigenStock] = useState("Bodega Yuyii");
  const [cantidadCarga, setCantidadCarga] = useState("");
  const [productoSeleccionado, setProductoSeleccionado] = useState("");

  // --- FILTROS ---
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroInventario, setFiltroInventario] = useState("");

  // --- CÁLCULOS Y FORMATEO ---
  const fM = (v) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);

  const ventasFiltradas = ventas.filter(v =>
    !v.pagado && v.cliente.toLowerCase().includes(filtroNombre.toLowerCase())
  );

  const totalF = ventasFiltradas.reduce((acc, v) => acc + v.precio, 0);

  const productosFiltrados = productos.filter(p =>
    p.nombre.toLowerCase().includes(filtroInventario.toLowerCase())
  );

  // --- FUNCIONES DE ACCIÓN ---

  const guardarPerfil = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('perfiles').insert([userForm]);
    if (error) alert("Error: " + error.message);
    else { setUserForm({ nombre: '', pin: '', rol: 'comprador' }); refresh(); }
  };

  const resetearStock = async (productoId, bodega) => {
    if (bodega === "General") return alert("Selecciona una bodega específica (Tienda o Bodega) para borrar su stock.");

    const confirmar = confirm(`¿Estás seguro de que quieres poner en 0 el stock de este producto en ${bodega}?`);
    if (!confirmar) return;

    try {
      // 1. Obtener el ID de la sucursal según el nombre de la pestaña
      const { data: sucursal } = await supabase
        .from('sucursales')
        .select('id')
        .eq('nombre', bodega)
        .single();

      if (!sucursal) throw new Error("Bodega no encontrada");

      // 2. Actualizar la tabla de existencias a 0 para esa combinación
      const { error } = await supabase
        .from('existencias')
        .update({ cantidad: 0 })
        .eq('producto_id', productoId)
        .eq('ubicacion_id', sucursal.id);

      if (error) throw error;

      alert("Stock reseteado correctamente.");
      refresh(); // Recargar datos
    } catch (err) {
      alert("Error al resetear stock: " + err.message);
    }
  };

  const [cargando, setCargando] = useState(false);

  const crearProducto = async (e) => {
    e.preventDefault();
    if (cargando) return;
    setCargando(true);

    try {
      const { data: productoCreado, error: errorP } = await supabase
        .from('productos')
        .insert([{
          nombre: nuevoProd.nombre,
          precio: parseInt(nuevoProd.precio),
          emoji: nuevoProd.emoji,
          imagen_url: nuevoProd.imagen_url, // <--- Enviamos la URL aquí
          stock: 0
        }])
        .select()
        .single();

      if (errorP) throw errorP;

      // ... (el resto del código de existencias se mantiene igual)

      alert("✨ Snack creado con éxito");
      // Limpiamos todo el formulario incluyendo la imagen
      setNuevoProd({ nombre: '', precio: '', emoji: '', stockInicial: 0, imagen_url: '' });
      refresh();

    } catch (err) {
      alert("❌ Error: " + err.message);
    } finally {
      setCargando(false);
    }
  };

  const procesarCarga = async () => {
    // 1. Validaciones iniciales
    if (!productoSeleccionado) return alert("Selecciona un snack");
    if (!cantidadCarga || cantidadCarga <= 0) return alert("Ingresa una cantidad válida");

    const cant = parseInt(cantidadCarga);
    const pId = parseInt(productoSeleccionado);

    try {
      // CASO A: Entrada desde Proveedor (Aumenta stock)
      if (origenStock === "Proveedor / Fábrica") {
        const { data: sDest, error: errD } = await supabase
          .from('sucursales')
          .select('id')
          .eq('nombre', sucursalDestino)
          .single();

        if (errD) throw new Error("No se encontró la bodega de destino");

        const { error: rpcErr } = await supabase.rpc('incrementar_stock', {
          p_id: pId,
          s_id: sDest.id,
          inc: cant
        });

        if (rpcErr) throw rpcErr;
      }

      // CASO B: Transferencia entre bodegas (Resta en origen, suma en destino)
      else {
        const { data: sOrig } = await supabase.from('sucursales').select('id').eq('nombre', origenStock).single();
        const { data: sDest } = await supabase.from('sucursales').select('id').eq('nombre', sucursalDestino).single();

        // Restar al origen
        await supabase.rpc('incrementar_stock', { p_id: pId, s_id: sOrig.id, inc: -cant });
        // Sumar al destino
        await supabase.rpc('incrementar_stock', { p_id: pId, s_id: sDest.id, inc: cant });
      }

      alert("✨ Inventario actualizado correctamente");
      setCantidadCarga(""); // Limpiar input
      if (typeof refresh === 'function') refresh(); // Refrescar datos

    } catch (err) {
      console.error("Error en proceso:", err);
      alert("❌ Error: " + err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-8 pb-20 font-sans">

      {/* 1. GESTIÓN DE USUARIOS */}
      <section className="bg-[#f989b7] p-8 rounded-[2.5rem] shadow-sm text-white no-print">
        <h2 className="text-xl font-black uppercase mb-6 italic">👥 Usuarios Registrados</h2>
        <form onSubmit={guardarPerfil} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <input placeholder="Nombre" className="p-4 rounded-2xl bg-white text-slate-800 font-bold" value={userForm.nombre} onChange={e => setUserForm({ ...userForm, nombre: e.target.value })} required />
          <input placeholder="PIN (4 núm)" className="p-4 rounded-2xl bg-white text-slate-800 font-bold text-center" value={userForm.pin} onChange={e => setUserForm({ ...userForm, pin: e.target.value.replace(/\D/g, '') })} required maxLength={4} inputMode="numeric" />
          <select className="p-4 rounded-2xl bg-white text-slate-800 font-bold" value={userForm.rol} onChange={e => setUserForm({ ...userForm, rol: e.target.value })}>
            <option value="comprador">Comprador</option>
            {role === 'superadmin' && <><option value="admin">Admin</option><option value="superadmin">SuperAdmin</option></>}
          </select>
          <button className="bg-slate-900 text-white font-black rounded-2xl uppercase hover:bg-black transition-all">Añadir</button>
        </form>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-slate-800">
          {perfiles.map(u => (
            <div key={u.id} className="bg-white/90 p-4 rounded-2xl shadow-sm relative group">
              {editandoId === u.id ? (
                <div className="space-y-2">
                  <input className="w-full p-2 rounded-lg border text-xs" value={tempUser.nombre} onChange={e => setTempUser({ ...tempUser, nombre: e.target.value })} />
                  <input className="w-full p-2 rounded-lg border text-xs text-center" value={tempUser.pin} onChange={e => setTempUser({ ...tempUser, pin: e.target.value.replace(/\D/g, '') })} maxLength={4} />
                  <button onClick={async () => { await supabase.from('perfiles').update(tempUser).eq('id', u.id); setEditandoId(null); refresh(); }} className="w-full bg-green-500 text-white text-[10px] py-2 rounded-lg font-bold">GUARDAR</button>
                </div>
              ) : (
                <>
                  <p className="font-black text-sm truncate uppercase">{u.nombre}</p>
                  <p className="text-[10px] font-bold opacity-50 uppercase italic">{u.rol}</p>
                  <p className="text-xs font-mono mt-1">{role === 'superadmin' ? `PIN: ${u.pin}` : 'PIN: ****'}</p>
                  {role === 'superadmin' && (
                    <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button onClick={() => { setEditandoId(u.id); setTempUser({ nombre: u.nombre, pin: u.pin }); }} className="bg-blue-500 text-white p-1 rounded">✎</button>
                      <button onClick={async () => { if (u.rol !== 'superadmin' && confirm('¿Borrar?')) { await supabase.from('perfiles').delete().eq('id', u.id); refresh(); } }} className="bg-red-500 text-white p-1 rounded">✕</button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 2. REGISTRAR NUEVO SNACK */}
      <section className="bg-white p-8 rounded-[2.5rem] shadow-sm no-print border border-slate-100">
        <h2 className="text-xl font-black uppercase mb-6 italic text-slate-800">✨ Registrar Nuevo Snack</h2>
        <form onSubmit={crearProducto} className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <input placeholder="Nombre (ej: Bianchi)" className="p-4 rounded-2xl bg-slate-50 font-bold" value={nuevoProd.nombre} onChange={e => setNuevoProd({ ...nuevoProd, nombre: e.target.value })} required />
          <input
            type="text"
            placeholder="URL de la imagen (Opcional)"
            className="p-4 rounded-2xl bg-slate-50 border-none font-bold"
            value={nuevoProd.imagen_url}
            onChange={e => setNuevoProd({ ...nuevoProd, imagen_url: e.target.value })}
          />
          <input type="number" placeholder="Precio $" className="p-4 rounded-2xl bg-slate-50 font-bold" value={nuevoProd.precio} onChange={e => setNuevoProd({ ...nuevoProd, precio: e.target.value })} required />
          <input type="number" placeholder="Stock Inicial" className="p-4 rounded-2xl bg-slate-50 font-bold text-center" value={nuevoProd.stockInicial} onChange={e => setNuevoProd({ ...nuevoProd, stockInicial: e.target.value })} required />
          <button className="bg-[#f989b7] text-white font-black rounded-2xl uppercase hover:scale-105 transition-all shadow-lg shadow-pink-100">Crear Snack</button>
        </form>
      </section>

      {/* 3. ABASTECIMIENTO MULTIDEPÓSITO */}
      <section className="bg-slate-900 p-8 rounded-[2.5rem] text-white no-print">
        <h2 className="text-xl font-black uppercase mb-6 italic text-pink-400">📦 Abastecimiento de Inventario</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select className="p-4 rounded-2xl bg-slate-800 text-white font-bold border-none" value={productoSeleccionado} onChange={e => setProductoSeleccionado(e.target.value)}>
            <option value="">Selecciona Snack...</option>
            {productos.map(p => <option key={p.id} value={p.id}>{p.emoji} {p.nombre}</option>)}
          </select>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-slate-500 ml-2">Destino (¿A dónde llega?)</span>
            <select className="p-4 rounded-2xl bg-slate-800 text-white font-bold" value={sucursalDestino} onChange={e => setSucursalDestino(e.target.value)}>
              <option value="Tienda">Tienda Física</option>
              <option value="Bodega Yuyii">Bodega Yuyii</option>
              <option value="Bodega Teban">Bodega Teban</option>
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] uppercase font-bold text-pink-500 ml-2">Origen (¿De dónde sale?)</span>
            <select className="p-4 rounded-2xl bg-pink-900/30 text-white font-bold border border-pink-500/30" value={origenStock} onChange={e => setOrigenStock(e.target.value)}>
              {(sucursalDestino === "Bodega Yuyii" || sucursalDestino === "Bodega Teban") ? (
                <option value="Proveedor / Fábrica">🏭 Proveedor (Ilimitado)</option>
              ) : (
                <><option value="Bodega Yuyii">Bodega Yuyii</option><option value="Bodega Teban">Bodega Teban</option></>
              )}
            </select>
          </div>
          <input type="number" placeholder="Cantidad" className="p-4 rounded-2xl bg-slate-800 text-white font-bold text-center" value={cantidadCarga} onChange={e => setCantidadCarga(e.target.value)} />
          <button onClick={procesarCarga} className="md:col-span-1 bg-pink-500 text-white font-black rounded-2xl uppercase hover:bg-pink-600 transition-all">Cargar Stock</button>
        </div>
      </section>

      {/* 4. CONTROL DE STOCK */}
      <section className="bg-white p-8 rounded-[2.5rem] shadow-sm no-print border border-slate-100">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <h2 className="text-xl font-black uppercase text-[#f989b7] italic">📦 Control de Stock</h2>
          <div className="flex bg-slate-100 p-1 rounded-xl overflow-x-auto">
            {["General", "Tienda", "Bodega Yuyii", "Bodega Teban"].map(opt => (
              <button key={opt} onClick={() => setVistaStock(opt)} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${vistaStock === opt ? "bg-white text-[#f989b7] shadow-sm" : "text-slate-400"}`}>
                {opt}
              </button>
            ))}
          </div>
        </div>
        <input placeholder="Buscar producto..." className="w-full bg-slate-50 p-4 rounded-2xl mb-6 font-bold" value={filtroInventario} onChange={e => setFiltroInventario(e.target.value)} />
        <div className="max-h-96 overflow-y-auto rounded-2xl border border-slate-50">
          {/* Dentro del tbody de Control de Stock */}
          <tbody className="divide-y divide-slate-50">
            {productosFiltrados.map(p => (
              <tr key={p.id} className="font-bold text-slate-600">
                <td className="p-4 uppercase flex items-center gap-3">
                  {p.imagen_url ? (
                    <img src={p.imagen_url} alt={p.nombre} className="w-8 h-8 rounded-lg object-cover" />
                  ) : (
                    <span className="text-xl">{p.emoji}</span>
                  )}
                  {p.nombre}
                </td>                <td className="p-4 text-center">
                  <span className={`px-4 py-1 rounded-full ${vistaStock === "General" ? "bg-slate-900 text-white" : "bg-[#f989b7]/10 text-[#f989b7]"}`}>
                    {vistaStock === "General" ? p.stockGeneral : vistaStock === "Tienda" ? p.stockTienda : vistaStock === "Bodega Yuyii" ? p.stockB1 : p.stockB2}
                  </span>
                </td>


                {/* NUEVA COLUMNA DE ACCIÓN PARA SUPERADMIN */}
                {role === 'superadmin' && (
                  <td className="p-4 text-center no-print">
                    <button
                      onClick={() => resetearStock(p.id, vistaStock)}
                      className="text-[10px] bg-red-100 text-red-500 px-2 py-1 rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                      title="Resetear stock a 0"
                    >
                      🗑️ Borrar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </div>
      </section>

      {/* 5. FACTURACIÓN */}
      <section className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm">
        <h2 className="font-black text-[#f989b7] uppercase mb-4 italic">🧾 Facturación Pendiente</h2>
        <div className="relative mb-6 no-print">
          <input placeholder="🔍 Buscar cliente..." className="w-full bg-slate-50 p-4 pl-12 rounded-2xl font-bold text-[#f989b7]" value={filtroNombre} onChange={(e) => setFiltroNombre(e.target.value)} />
        </div>
        <div className="max-h-96 overflow-y-auto mb-6 border border-slate-50 rounded-2xl text-[11px]">
          <table className="w-full">
            <thead className="bg-slate-50 sticky top-0 font-black uppercase text-slate-400">
              <tr><th className="p-4 text-left">Fecha</th><th className="p-4 text-left">Cliente</th><th className="p-4 text-left">Producto</th><th className="p-4 text-right">Precio</th><th className="p-4 text-center no-print">Acción</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {ventasFiltradas.map(v => (
                <tr key={v.id} className="font-bold text-slate-600">
                  <td className="p-4 text-slate-400">{v.fecha}</td>
                  <td className="p-4"><span className="bg-[#f989b7]/10 text-[#f989b7] px-2 py-1 rounded uppercase text-[9px]">{v.cliente}</span></td>
                  <td className="p-4 uppercase">{v.producto}</td>
                  <td className="p-4 text-right">{fM(v.precio)}</td>
                  <td className="p-4 text-center no-print">
                    {role === 'superadmin' && <button onClick={async () => { if (confirm('¿Borrar?')) { await supabase.from('ventas').delete().eq('id', v.id); refresh(); } }} className="text-red-400">✕</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col md:flex-row justify-between items-center bg-slate-50 p-6 rounded-[2rem] gap-4">
          <div><p className="text-[10px] font-black text-slate-400 uppercase">Total Seleccionado</p><h3 className="text-3xl font-black text-[#f989b7] italic">{fM(totalF)}</h3></div>
          <div className="flex gap-2 w-full md:w-auto no-print">
            <button onClick={() => window.print()} className="bg-white border px-6 py-3 rounded-xl font-black uppercase text-[10px]">🖨️ Imprimir</button>
            {role === 'superadmin' && filtroNombre && totalF > 0 && (
              <button onClick={async () => { if (confirm(`Saldar deuda de ${ventasFiltradas[0]?.cliente}?`)) { await supabase.from('ventas').update({ pagado: true }).eq('cliente', ventasFiltradas[0]?.cliente).eq('pagado', false); setFiltroNombre(""); refresh(); } }} className="bg-[#f989b7] text-white px-8 py-3 rounded-xl font-black uppercase text-[10px] shadow-lg shadow-pink-200">✅ Saldar Deuda</button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default App;