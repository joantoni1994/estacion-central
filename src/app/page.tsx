'use client';
import { useState, useEffect } from 'react';
import { Trash2, Edit, Save, X, CheckCircle, CalendarDays, Search, Star, Download, CloudUpload } from 'lucide-react';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase'; 

export default function Dashboard() {
  const [acuerdos, setAcuerdos] = useState<any[]>([]);
  const [pestaña, setPestaña] = useState('activa');
  const [filtroBodega, setFiltroBodega] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [tempEdit, setTempEdit] = useState<any>({});
  const [nuevoPeriodo, setNuevoPeriodo] = useState<Record<number, string>>({});
  
  // Estado para saber si hay datos pendientes de subir
  const [hayDatosLocales, setHayDatosLocales] = useState(false);

  useEffect(() => {
    // 1. Cargamos lo local para que no desaparezca de tu pantalla
    const locales = JSON.parse(localStorage.getItem('acuerdosMock') || '[]');
    if (locales.length > 0) {
      setHayDatosLocales(true);
      setAcuerdos(locales);
    }

    // 2. Escuchamos a Firebase
    const unsubscribe = onSnapshot(collection(db, 'acuerdos'), (snapshot) => {
      const datosNube = snapshot.docs.map(doc => doc.data());
      // Si Firebase ya tiene datos, los usamos y quitamos el aviso
      if (datosNube.length > 0) {
        setAcuerdos(datosNube);
        setHayDatosLocales(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // --- BOTÓN MÁGICO DE MIGRACIÓN ---
  const migrarNube = async () => {
    try {
      const locales = JSON.parse(localStorage.getItem('acuerdosMock') || '[]');
      for (const ac of locales) {
        // Guarda cada acuerdo en la nube
        await setDoc(doc(db, 'acuerdos', ac.id.toString()), ac);
      }
      alert('¡Datos subidos a Firebase con éxito! ☁️');
      localStorage.removeItem('acuerdosMock'); // Limpiamos el rastro local
      setHayDatosLocales(false);
    } catch (error) {
      console.error("Error de Firebase:", error);
      alert('Error al subir a la nube. (Asegúrate de que pusiste Firestore en "Modo Prueba")');
    }
  };

  const actualizarEnNube = async (acuerdoModificado: any) => {
    try {
      await setDoc(doc(db, 'acuerdos', acuerdoModificado.id.toString()), acuerdoModificado);
    } catch(e) {
      console.error(e);
    }
  };

  const exportarBackup = () => {
    const datos = JSON.stringify(acuerdos); // Ahora exporta lo que haya en pantalla
    if (datos === '[]') return alert('No hay datos para exportar.');
    const blob = new Blob([datos], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Copia_Seguridad_Acuerdos_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const iniciarEdicion = (acuerdo: any) => { setEditId(acuerdo.id); setTempEdit({...acuerdo}); };

  const guardarEdicion = () => {
    const prod = tempEdit.producto?.trim() === '' ? 'Toda la bodega' : tempEdit.producto;
    const cli = tempEdit.cliente?.trim() === '' ? 'Todos los clientes' : tempEdit.cliente;
    actualizarEnNube({ ...tempEdit, producto: prod, cliente: cli });
    setEditId(null);
  };

  const agregarQ = (id: number) => {
    if (!nuevoPeriodo[id]) return;
    const acuerdo = acuerdos.find(a => a.id === id);
    if (!acuerdo) return;
    const nuevoAc = { ...acuerdo, reclamaciones: [...(acuerdo.reclamaciones || []), {id: Date.now(), periodo: nuevoPeriodo[id], situacion: 'Pendiente', notas: '', destacado: false}] };
    actualizarEnNube(nuevoAc);
    setNuevoPeriodo({...nuevoPeriodo, [id]: ''});
  };

  const cambiarEstado = (aId: number, rId: number, estado: string) => {
    const acuerdo = acuerdos.find(a => a.id === aId);
    if (!acuerdo) return;
    const fechaHoy = new Date().toLocaleDateString('es-ES');
    const nuevoAc = { ...acuerdo, reclamaciones: acuerdo.reclamaciones.map((r: any) => {
        if (r.id === rId) return { ...r, situacion: estado, fechaReclamacion: estado === 'Reclamado' ? (r.fechaReclamacion || fechaHoy) : r.fechaReclamacion, fechaPago: estado === 'Pagado' ? (r.fechaPago || fechaHoy) : r.fechaPago };
        return r;
      })
    };
    actualizarEnNube(nuevoAc);
  };

  const guardarNotasPeriodo = (aId: number, rId: number, notas: string) => {
    const acuerdo = acuerdos.find(a => a.id === aId);
    if (!acuerdo) return;
    actualizarEnNube({ ...acuerdo, reclamaciones: acuerdo.reclamaciones.map((r: any) => r.id === rId ? { ...r, notas } : r) });
  };

  const toggleDestacadoAcuerdo = (aId: number) => {
    const acuerdo = acuerdos.find(a => a.id === aId);
    if (acuerdo) actualizarEnNube({ ...acuerdo, destacado: !acuerdo.destacado });
  };

  const toggleDestacadoPeriodo = (aId: number, rId: number) => {
    const acuerdo = acuerdos.find(a => a.id === aId);
    if (acuerdo) actualizarEnNube({ ...acuerdo, reclamaciones: acuerdo.reclamaciones.map((r: any) => r.id === rId ? { ...r, destacado: !r.destacado } : r) });
  };

  const borrarAcuerdo = async (id: number) => {
    if(confirm("¿Borrar este acuerdo para siempre en la nube?")) {
      await deleteDoc(doc(db, 'acuerdos', id.toString()));
    }
  };

  const borrarPeriodo = (aId: number, rId: number) => {
    const acuerdo = acuerdos.find(a => a.id === aId);
    if (acuerdo) actualizarEnNube({ ...acuerdo, reclamaciones: acuerdo.reclamaciones.filter((rec: any) => rec.id !== rId) });
  };

  const acuerdosFiltrados = acuerdos.filter(a => a.bodega.toLowerCase().includes(filtroBodega.toLowerCase()));
  const agrupadas = acuerdosFiltrados.reduce((acc: Record<string, any[]>, obj: any) => {
    const key = obj.bodega.trim().toUpperCase();
    if (!acc[key]) acc[key] = [];
    acc[key].push(obj);
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      
      {/* AVISO DE MIGRACIÓN GIGANTE */}
      {hayDatosLocales && (
        <div className="bg-blue-50 border-2 border-blue-400 p-5 rounded-lg mb-6 flex flex-col md:flex-row justify-between items-center shadow-md">
          <div className="mb-4 md:mb-0">
            <h3 className="font-black text-blue-900 text-lg">⚠️ Tienes datos locales pendientes de subir a Firebase</h3>
            <p className="text-sm text-blue-700 mt-1">Haz clic en el botón de la derecha para guardar todo esto en la nube de forma segura.</p>
          </div>
          <button onClick={migrarNube} className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded font-bold hover:bg-blue-700 shadow-lg text-lg animate-pulse">
            <CloudUpload size={24} /> Subir a la Nube
          </button>
        </div>
      )}

      <div className="sticky top-0 z-20 bg-gray-50 pt-4 md:pt-6 pb-2 -mx-4 px-4 md:-mx-6 md:px-6 -mt-4 md:-mt-6 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-slate-800">Estación Central</h1>
          <div className="flex gap-2">
            <button onClick={exportarBackup} className="flex items-center gap-1 bg-slate-200 text-slate-700 px-3 py-1.5 rounded text-sm font-bold shadow-sm hover:bg-slate-300">
              <Download size={16} /> Backup
            </button>
            <a href="/nueva-reclamacion" className="inline-block bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-bold shadow hover:bg-blue-700">
              + Nuevo Acuerdo
            </a>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b pb-2 text-sm">
          <div className="flex gap-4">
            <button onClick={() => setPestaña('activa')} className={`pb-1 px-2 ${pestaña === 'activa' ? 'border-b-2 border-slate-900 font-bold text-slate-900' : 'text-gray-500'}`}>Gestión Activa</button>
            <button onClick={() => setPestaña('pagada')} className={`pb-1 px-2 ${pestaña === 'pagada' ? 'border-b-2 border-green-600 font-bold text-green-700' : 'text-gray-500'}`}>Histórico Pagado</button>
            <button onClick={() => setPestaña('seguimiento')} className={`pb-1 px-2 flex items-center gap-1 ${pestaña === 'seguimiento' ? 'border-b-2 border-yellow-500 font-bold text-yellow-600' : 'text-gray-500'}`}>
              <Star size={14} className={pestaña === 'seguimiento' ? 'fill-yellow-500' : ''} /> Seguimiento
            </button>
          </div>
          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="text" placeholder="Buscar bodega..." value={filtroBodega} onChange={(e) => setFiltroBodega(e.target.value)} className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white" />
          </div>
        </div>
      </div>

      {Object.entries(agrupadas).map(([bodega, lista]: [string, any[]]) => {
        const tieneContenido = lista.some((a: any) => {
          if (pestaña === 'activa') return true;
          if (pestaña === 'pagada') return a.reclamaciones.some((r:any) => r.situacion === 'Pagado');
          if (pestaña === 'seguimiento') return a.destacado || a.reclamaciones.some((r:any) => r.destacado);
          return false;
        });

        if (!tieneContenido) return null;

        return (
          <div key={bodega} className="mb-4 border border-slate-300 rounded bg-white shadow-sm">
            <div className="bg-slate-800 text-white px-3 py-1.5 font-bold text-sm tracking-wide flex justify-between items-center">
              <span className="uppercase">{bodega}</span>
              <a href={`/nueva-reclamacion?bodega=${encodeURIComponent(bodega)}`} className="text-xs bg-slate-700 hover:bg-slate-600 px-2 py-0.5 rounded cursor-pointer text-white">+ Acuerdo aquí</a>
            </div>
            
            <div className="divide-y divide-gray-200">
              {lista.map((a: any) => {
                const items: any[] = (a.reclamaciones || []).filter((r: any) => {
                  if (pestaña === 'activa') return r.situacion !== 'Pagado';
                  if (pestaña === 'pagada') return r.situacion === 'Pagado';
                  if (pestaña === 'seguimiento') return r.destacado || (a.destacado && r.situacion !== 'Pagado');
                  return false;
                });

                if ((pestaña === 'pagada' || pestaña === 'seguimiento') && items.length === 0 && !a.destacado) return null;

                return (
                  <div key={a.id} className={`p-2 ${a.destacado ? 'bg-yellow-50/30' : ''}`}>
                    <div className={`flex justify-between items-start border px-3 py-2 rounded mb-1.5 ${a.destacado ? 'bg-yellow-100/50 border-yellow-200' : 'bg-slate-50 border-slate-200'}`}>
                      {editId === a.id ? (
                        <div className="grid grid-cols-2 gap-1.5 flex-1 mr-3">
                          <input placeholder="Cliente" value={tempEdit.cliente} onChange={e => setTempEdit({...tempEdit, cliente: e.target.value})} className="border p-1 text-xs rounded font-bold" />
                          <input placeholder="Bodega" value={tempEdit.bodega} onChange={e => setTempEdit({...tempEdit, bodega: e.target.value})} className="border p-1 text-xs rounded" />
                          <input placeholder="Producto" value={tempEdit.producto} onChange={e => setTempEdit({...tempEdit, producto: e.target.value})} className="border p-1 text-xs rounded" />
                          <input placeholder="Tipo" value={tempEdit.tipoAportacion} onChange={e => setTempEdit({...tempEdit, tipoAportacion: e.target.value})} className="border p-1 text-xs rounded" />
                          <input placeholder="Observaciones..." value={tempEdit.observaciones} onChange={e => setTempEdit({...tempEdit, observaciones: e.target.value})} className="border p-1 text-xs rounded col-span-2" />
                        </div>
                      ) : (
                        <div className="flex-1 flex gap-2 items-start">
                          <button onClick={() => toggleDestacadoAcuerdo(a.id)} className={`mt-0.5 ${a.destacado ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}`}><Star size={16} className={a.destacado ? 'fill-yellow-500' : ''} /></button>
                          <div>
                            <h3 className="font-bold text-sm text-slate-800">{a.cliente}</h3>
                            <p className="text-xs text-slate-500 mt-0.5"><span className="font-semibold text-slate-600">Prod:</span> {a.producto} <span className="mx-1">|</span> <span className="font-semibold text-slate-600">Tipo:</span> {a.tipoAportacion}</p>
                            {a.observaciones && <p className={`text-xs italic mt-1 px-2 py-0.5 rounded border inline-block ${a.destacado ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-white border-dashed border-gray-200'}`}>"{a.observaciones}"</p>}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex gap-2 ml-2">
                        {editId === a.id ? (
                          <>
                            <button onClick={guardarEdicion} className="text-green-600 p-0.5 rounded"><Save size={16}/></button>
                            <button onClick={() => setEditId(null)} className="text-red-500 p-0.5 rounded"><X size={16}/></button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => iniciarEdicion(a)} className="text-slate-400 hover:text-blue-600"><Edit size={14}/></button>
                            <button onClick={() => borrarAcuerdo(a.id)} className="text-slate-300 hover:text-red-500"><Trash2 size={14}/></button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="ml-2 pl-2 border-l-2 border-slate-100 space-y-1">
                      {items.map((r: any) => (
                        <div key={r.id} className={`flex justify-between items-center text-xs py-1 border-b border-dashed border-gray-100 last:border-0 gap-2 ${r.destacado ? 'bg-yellow-50/50 rounded px-1' : ''}`}>
                          <div className="flex items-center gap-2 flex-1">
                            <button onClick={() => toggleDestacadoPeriodo(a.id, r.id)} className={r.destacado ? 'text-yellow-500' : 'text-gray-300 hover:text-yellow-400'}><Star size={14} className={r.destacado ? 'fill-yellow-500' : ''} /></button>
                            <span className="font-medium text-slate-700 w-16 truncate">{r.periodo}</span>
                            {(r.situacion === 'Reclamado' || r.situacion === 'Pagado') && (
                              <>
                                <span className={`flex items-center gap-1 font-semibold px-1.5 py-0.5 rounded ${r.situacion === 'Pagado' ? 'text-green-600 bg-green-50' : 'text-orange-500 bg-orange-50'}`}><CalendarDays size={12} /> {r.situacion === 'Reclamado' ? r.fechaReclamacion : r.fechaPago}</span>
                                <input type="text" placeholder={r.situacion === 'Pagado' ? "Notas del abono..." : "Notas de reclamación..."} value={r.notas || ''} onChange={(e) => guardarNotasPeriodo(a.id, r.id, e.target.value)} className={`flex-1 border p-0.5 px-1.5 rounded focus:outline-none min-w-[100px] ${r.situacion === 'Pagado' ? 'bg-green-50/30 border-green-100' : 'bg-orange-50/30 border-orange-100'}`} />
                              </>
                            )}
                          </div>
                          <div className="flex gap-2 items-center">
                            {pestaña === 'activa' || pestaña === 'seguimiento' ? (
                              <select value={r.situacion} onChange={e => cambiarEstado(a.id, r.id, e.target.value)} className={`border rounded py-0.5 px-1 font-bold ${r.situacion === 'Reclamado' ? 'text-orange-600 border-orange-300 bg-orange-50' : 'text-slate-600'}`}>
                                <option value="Pendiente">Pendiente</option><option value="Reclamado">Reclamado</option><option value="Pagado">Marcar Pagado</option>
                              </select>
                            ) : <span className="text-green-600 font-bold flex items-center gap-1 bg-green-50 px-1.5 py-0.5 rounded"><CheckCircle size={12}/> Pagado</span>}
                            <button onClick={() => borrarPeriodo(a.id, r.id)} className="text-gray-300 hover:text-red-500"><Trash2 size={14}/></button>
                          </div>
                        </div>
                      ))}
                      {pestaña === 'activa' && (
                        <div className="flex gap-2 mt-1 pt-1 ml-6">
                          <input placeholder="Añadir (ej. Q1)" value={nuevoPeriodo[a.id] || ''} onChange={e => setNuevoPeriodo({...nuevoPeriodo, [a.id]: e.target.value})} className="text-xs border border-slate-300 py-0.5 px-2 rounded w-36" />
                          <button onClick={() => agregarQ(a.id)} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded hover:bg-blue-100">+ Añadir</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}