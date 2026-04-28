'use client';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, FileDown, Loader2, Wine, BarChart3, Link as LinkIcon, Save, Download } from 'lucide-react';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../../firebase'; 

export default function AnalizadorPromos() {
  const [procesando, setProcesando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'exito' | 'error' | 'info' } | null>(null);
  
  const [resumenProductos, setResumenProductos] = useState<{ descripcion: string; cantidad: number }[]>([]);
  const [totalBotellas, setTotalBotellas] = useState(0);
  const [datosExtraidos, setDatosExtraidos] = useState<any[]>([]); 
  
  const [acuerdos, setAcuerdos] = useState<any[]>([]);
  const [bodegaSel, setBodegaSel] = useState('');
  const [acuerdoSel, setAcuerdoSel] = useState('');
  const [reclamacionSel, setReclamacionSel] = useState('');

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'acuerdos'), (snapshot) => {
      setAcuerdos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  // SOLUCIÓN 5: Agrupamos las bodegas en mayúsculas para evitar duplicados por minúsculas
  const bodegasUnicas = Array.from(new Set(acuerdos.map(a => a.bodega.trim().toUpperCase()))).sort();
  const acuerdosDeBodega = acuerdos.filter(a => a.bodega.trim().toUpperCase() === bodegaSel.toUpperCase());
  const acuerdoElegido = acuerdosDeBodega.find(a => a.id.toString() === acuerdoSel);
  const reclamacionesDisponibles = acuerdoElegido?.reclamaciones || [];

  const procesarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcesando(true);
    setMensaje({ texto: 'Analizando documento...', tipo: 'info' });
    setResumenProductos([]);
    setTotalBotellas(0);
    setDatosExtraidos([]); 

    const reader = new FileReader();
    reader.onload = (evento) => {
      try {
        const data = new Uint8Array(evento.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        let filasBrutas: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

        if (filasBrutas.length === 0) throw new Error("Vacío");
        if (filasBrutas.length > 0 && filasBrutas[0].length === 1 && String(filasBrutas[0][0]).includes(';')) {
          filasBrutas = filasBrutas.map(fila => String(fila[0] || '').split(';'));
        }

        let filaCabeceras = -1, colDocum = -1, colCodigo = -1, colDto = -1, colCant = -1, colDesc = -1;

        for (let i = 0; i < filasBrutas.length; i++) {
          const fila = filasBrutas[i];
          if (!Array.isArray(fila)) continue;
          let tempDoc = -1, tempCod = -1, tempDto = -1, tempCant = -1, tempDesc = -1;
          
          fila.forEach((celda, index) => {
            const t = String(celda).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, ''); 
            if (t.includes('docum') || t.includes('factura')) tempDoc = index;
            if (t.includes('codigo') || t.includes('cod') || t.includes('articulo')) tempCod = index;
            if (t.includes('dto') || t.includes('descuento')) tempDto = index;
            if (t === 'cant' || t.includes('cantidad') || t.includes('uds')) tempCant = index;
            if (t.includes('descrip') || t.includes('nombre')) tempDesc = index;
          });

          if (tempDoc !== -1 && tempCod !== -1 && tempDto !== -1) {
            filaCabeceras = i; colDocum = tempDoc; colCodigo = tempCod; colDto = tempDto; colCant = tempCant; colDesc = tempDesc; break;
          }
        }

        if (filaCabeceras === -1) { setMensaje({ texto: 'Faltan cabeceras.', tipo: 'error' }); setProcesando(false); return; }

        const identificadores = new Set<string>();
        const mapaResumen: Record<string, number> = {};
        let sumaBotellas = 0;

        for (let i = filaCabeceras + 1; i < filasBrutas.length; i++) {
          const fila = filasBrutas[i];
          if (!fila || fila.length === 0) continue;
          
          const valNum = parseFloat(String(fila[colDto] || '').replace(/%/g, '').replace(/\s/g, '').replace(/-/g, '').replace(/,/g, '.'));
          if (valNum === 100 || valNum === 1) {
            const docum = String(fila[colDocum] || '').trim();
            const codigo = String(fila[colCodigo] || '').trim();
            if (docum && codigo) {
              identificadores.add(`${docum}_${codigo}`);
              if (colCant !== -1 && colDesc !== -1) {
                const cant = Math.abs(parseFloat(String(fila[colCant] || '').replace(/,/g, '.')) || 0);
                const desc = String(fila[colDesc] || '').trim() || 'Sin descripción';
                if (cant > 0) { mapaResumen[desc] = (mapaResumen[desc] || 0) + cant; sumaBotellas += cant; }
              }
            }
          }
        }

        const filasFiltradas = [filasBrutas[filaCabeceras]]; 
        for (let i = filaCabeceras + 1; i < filasBrutas.length; i++) {
          const fila = filasBrutas[i];
          if (!fila || fila.length === 0) continue;
          if (identificadores.has(`${String(fila[colDocum] || '').trim()}_${String(fila[colCodigo] || '').trim()}`)) {
            filasFiltradas.push(fila);
          }
        }

        setDatosExtraidos(filasFiltradas);
        setResumenProductos(Object.entries(mapaResumen).map(([desc, cant]) => ({ descripcion: desc, cantidad: cant })).sort((a, b) => b.cantidad - a.cantidad));
        setTotalBotellas(sumaBotellas);

        setMensaje({ texto: `¡Extracción completada! Revisa el resumen.`, tipo: 'exito' });
        setProcesando(false);

      } catch (error) {
        setMensaje({ texto: 'Error al leer el archivo.', tipo: 'error' });
        setProcesando(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // SOLUCIÓN 1: Botón para descargar el Excel libremente antes de vincular
  const descargarLibre = () => {
    if (datosExtraidos.length === 0) return;
    const nuevaHoja = XLSX.utils.aoa_to_sheet(datosExtraidos);
    const nuevoLibro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(nuevoLibro, nuevaHoja, "Promos");
    XLSX.writeFile(nuevoLibro, `Extraccion_Sin_Vincular_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const vincularYGuardar = async () => {
    if (!bodegaSel || !acuerdoSel || !reclamacionSel) return alert('Por favor, selecciona Bodega, Acuerdo y Periodo.');
    
    setGuardando(true);
    try {
      const nombrePeriodo = reclamacionesDisponibles.find((r:any) => r.id.toString() === reclamacionSel)?.periodo || 'Desconocido';

      await addDoc(collection(db, 'archivos_promos'), {
        fechaSubida: new Date().toISOString(),
        bodega: bodegaSel,
        acuerdoId: acuerdoSel,
        reclamacionId: reclamacionSel,
        nombrePeriodo: nombrePeriodo,
        totalBotellas: totalBotellas,
        resumen: resumenProductos,
        datosExcel: JSON.stringify(datosExtraidos)
      });

      setMensaje({ texto: '✅ ¡Archivo guardado y vinculado en la nube con éxito!', tipo: 'exito' });
      // SOLUCIÓN 2: Ya NO borramos el resumen de la pantalla. Se queda visible.
      setBodegaSel(''); setAcuerdoSel(''); setReclamacionSel('');

    } catch (error) {
      setMensaje({ texto: 'Error al guardar en la nube.', tipo: 'error' });
    }
    setGuardando(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-slate-800">Analizador de Promociones</h1>
        <p className="text-slate-500 mt-1">Extrae botellas sin cargo y vincúlalas a tus reclamaciones.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        
        <div className="bg-white p-8 rounded-xl border-2 border-dashed border-blue-200 text-center shadow-sm flex flex-col justify-center min-h-[300px]">
          {procesando ? (
            <div className="flex flex-col items-center">
              <Loader2 size={48} className="text-blue-600 animate-spin mb-4" />
              <h3 className="text-lg font-bold">Crujiendo los números...</h3>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <FileDown size={40} className="text-blue-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">1. Sube tu Excel</h3>
              <p className="text-slate-500 mb-6 text-sm">Sube el archivo bruto del ERP.</p>
              <label className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-bold shadow transition flex items-center gap-2">
                <UploadCloud size={20} /> Seleccionar Archivo
                <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={procesarArchivo} onClick={(e) => { (e.target as HTMLInputElement).value = ''; }} />
              </label>
            </div>
          )}
        </div>

        <div className={`bg-white rounded-xl border shadow-sm flex flex-col h-full overflow-hidden ${resumenProductos.length > 0 ? 'border-green-200' : 'opacity-50 pointer-events-none'}`}>
          <div className="p-4 border-b bg-green-50 text-green-800 flex items-center gap-2 justify-between">
            <div className="flex items-center gap-2"><BarChart3 size={20} /><h3 className="font-bold">2. Resumen</h3></div>
            {/* NUEVO BOTON DE DESCARGAR */}
            {datosExtraidos.length > 0 && (
              <button onClick={descargarLibre} className="flex items-center gap-1 bg-white text-green-700 px-3 py-1 rounded shadow-sm text-xs font-bold hover:bg-green-100">
                <Download size={14}/> Descargar Excel
              </button>
            )}
          </div>
          <div className="p-6 flex-1">
            {resumenProductos.length > 0 && (
              <>
                <div className="flex items-center gap-4 mb-4 bg-slate-800 text-white p-4 rounded-lg">
                  <Wine size={28} className="text-green-400" />
                  <div><p className="text-sm font-medium">Botellas sin cargo</p><p className="text-3xl font-black">{totalBotellas}</p></div>
                </div>
                <div className="overflow-y-auto max-h-[150px] space-y-1">
                  {resumenProductos.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm p-2 bg-slate-50 border rounded">
                      <span className="truncate pr-2">{item.descripcion}</span><span className="font-bold text-blue-800">{item.cantidad}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {datosExtraidos.length > 0 && (
        <div className="bg-slate-800 rounded-xl p-6 shadow-lg text-white animate-fade-in-up">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><LinkIcon size={20} className="text-blue-400"/> 3. Guardar en la Nube y Vincular</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            
            <select value={bodegaSel} onChange={(e) => {setBodegaSel(e.target.value); setAcuerdoSel(''); setReclamacionSel('');}} className="p-2 rounded bg-slate-700 border border-slate-600 focus:ring-2 focus:ring-blue-500 outline-none uppercase">
              <option value="">-- Selecciona Bodega --</option>
              {bodegasUnicas.map(b => <option key={b} value={b}>{b}</option>)}
            </select>

            <select value={acuerdoSel} onChange={(e) => {setAcuerdoSel(e.target.value); setReclamacionSel('');}} disabled={!bodegaSel} className="p-2 rounded bg-slate-700 border border-slate-600 disabled:opacity-50 outline-none">
              <option value="">-- Selecciona Acuerdo --</option>
              {acuerdosDeBodega.map(a => <option key={a.id} value={a.id}>{a.cliente} - {a.producto}</option>)}
            </select>

            <select value={reclamacionSel} onChange={(e) => setReclamacionSel(e.target.value)} disabled={!acuerdoSel} className="p-2 rounded bg-slate-700 border border-slate-600 disabled:opacity-50 outline-none">
              <option value="">-- Selecciona Periodo --</option>
              {reclamacionesDisponibles.map((r:any) => <option key={r.id} value={r.id}>{r.periodo} ({r.situacion})</option>)}
            </select>

          </div>
          
          <button 
            onClick={vincularYGuardar} 
            disabled={!bodegaSel || !acuerdoSel || !reclamacionSel || guardando}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg flex justify-center items-center gap-2 transition"
          >
            {guardando ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {guardando ? 'Guardando...' : 'Vincular y Guardar Archivo'}
          </button>
        </div>
      )}

      {mensaje && <div className={`mt-6 p-4 rounded-lg border text-center font-medium ${mensaje.tipo === 'exito' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}>{mensaje.texto}</div>}
    </div>
  );
}