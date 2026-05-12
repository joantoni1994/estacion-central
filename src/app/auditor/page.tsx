'use client';
import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, FileDown, Loader2, Wine, BarChart3, Link as LinkIcon, Save, Download, FileText } from 'lucide-react';
import { collection, onSnapshot, addDoc } from 'firebase/firestore';
import { db } from '../../firebase'; 
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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
            if (t.includes('codigo') || t.includes('cod')) tempDoc = index; // Aceptamos codigos como docum para emparejar
            if (t.includes('codigo') || t.includes('cod')) tempCod = index;
            if (t.includes('dto') || t.includes('descuento')) tempDto = index;
            if (t === 'cant' || t.includes('cantidad') || t.includes('uds')) tempCant = index;
            if (t.includes('descrip') || t.includes('nombre')) tempDesc = index;
          });

          if (tempDoc !== -1 && tempCod !== -1 && tempDto !== -1) {
            filaCabeceras = i; colDocum = tempDoc; colCodigo = tempCod; colDto = tempDto; colCant = tempCant; colDesc = tempDesc; break;
          }
        }

        const identificadores = new Set<string>();
        const mapaResumen: Record<string, number> = {};
        let sumaBotellas = 0;

        for (let i = filaCabeceras + 1; i < filasBrutas.length; i++) {
          const fila = filasBrutas[i];
          if (!fila) continue;
          const valNum = parseFloat(String(fila[colDto] || '').replace(/%/g, '').replace(/\s/g, '').replace(/-/g, '').replace(/,/g, '.'));
          if (valNum === 100 || valNum === 1) {
            const docum = String(fila[colDocum] || '').trim();
            const codigo = String(fila[colCodigo] || '').trim();
            if (docum && codigo) {
              identificadores.add(`${docum}_${codigo}`);
              const cant = Math.abs(parseFloat(String(fila[colCant] || '').replace(/,/g, '.')) || 0);
              const desc = String(fila[colDesc] || '').trim() || 'Sin descripción';
              if (cant > 0) { mapaResumen[desc] = (mapaResumen[desc] || 0) + cant; sumaBotellas += cant; }
            }
          }
        }

        const filasFiltradas = [filasBrutas[filaCabeceras]]; 
        for (let i = filaCabeceras + 1; i < filasBrutas.length; i++) {
          const fila = filasBrutas[i];
          if (!fila) continue;
          if (identificadores.has(`${String(fila[colDocum] || '').trim()}_${String(fila[colCodigo] || '').trim()}`)) {
            filasFiltradas.push(fila);
          }
        }

        setDatosExtraidos(filasFiltradas);
        setResumenProductos(Object.entries(mapaResumen).map(([desc, cant]) => ({ descripcion: desc, cantidad: cant })).sort((a, b) => b.cantidad - a.cantidad));
        setTotalBotellas(sumaBotellas);
        setMensaje({ texto: `¡Extracción completada!`, tipo: 'exito' });
        setProcesando(false);
      } catch (error) {
        setMensaje({ texto: 'Error al leer el archivo.', tipo: 'error' });
        setProcesando(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const descargarExcel = () => {
    const nuevaHoja = XLSX.utils.aoa_to_sheet(datosExtraidos);
    const nuevoLibro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(nuevoLibro, nuevaHoja, "Promos");
    XLSX.writeFile(nuevoLibro, `Extraccion_Promos_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // NUEVO: Función para generar el PDF profesional
  const descargarPDF = () => {
    const doc = new jsPDF();
    const fecha = new Date().toLocaleDateString('es-ES');

    // Título y Estética
    doc.setFontSize(20);
    doc.setTextColor(30, 41, 59); // Slate-800
    doc.text('RESUMEN DE RECLAMACIÓN', 14, 22);
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Fecha de generación: ${fecha}`, 14, 30);
    doc.text(`Bodega: ${bodegaSel || 'Pendiente de vincular'}`, 14, 35);

    // Cuadro de Impacto
    doc.setFillColor(241, 245, 249); // Slate-100
    doc.roundedRect(14, 45, 180, 25, 3, 3, 'F');
    
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('TOTAL BOTELLAS SIN CARGO:', 20, 56);
    
    doc.setFontSize(24);
    doc.setTextColor(37, 99, 235); // Blue-600
    doc.text(`${totalBotellas}`, 150, 62, { align: 'right' });

    // Tabla de referencias
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.text('Desglose de productos:', 14, 85);

    autoTable(doc, {
      startY: 90,
      head: [['Descripción del Producto', 'Cantidad (Unidades)']],
      body: resumenProductos.map(p => [p.descripcion, p.cantidad]),
      headStyles: { fillColor: [30, 41, 59], fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      styles: { fontSize: 10, cellPadding: 4 },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } }
    });

    doc.save(`Resumen_Reclamacion_${bodegaSel || 'Promos'}.pdf`);
  };

  const vincularYGuardar = async () => {
    if (!bodegaSel || !acuerdoSel || !reclamacionSel) return alert('Selecciona todos los campos.');
    setGuardando(true);
    try {
      const nombrePeriodo = reclamacionesDisponibles.find((r:any) => r.id.toString() === reclamacionSel)?.periodo || 'Desconocido';
      await addDoc(collection(db, 'archivos_promos'), {
        fechaSubida: new Date().toISOString(),
        bodega: bodegaSel,
        acuerdoId: acuerdoSel,
        reclamacionId: reclamacionSel,
        nombrePeriodo,
        totalBotellas,
        resumen: resumenProductos,
        datosExcel: JSON.stringify(datosExtraidos)
      });
      setMensaje({ texto: '✅ Vinculado con éxito.', tipo: 'exito' });
    } catch (error) {
      setMensaje({ texto: 'Error al guardar.', tipo: 'error' });
    }
    setGuardando(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto">
      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-slate-800">Analizador de Promociones</h1>
        <p className="text-slate-500 mt-1">Extrae y genera informes de reclamación al instante.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-8 rounded-xl border-2 border-dashed border-blue-200 text-center flex flex-col justify-center min-h-[300px]">
          {procesando ? <Loader2 size={40} className="animate-spin mx-auto text-blue-600" /> : (
            <div className="flex flex-col items-center">
              <FileDown size={40} className="text-blue-600 mb-4" />
              <h3 className="text-xl font-bold mb-2">1. Sube tu Excel</h3>
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
            {resumenProductos.length > 0 && (
              <div className="flex gap-2">
                <button onClick={descargarExcel} className="flex items-center gap-1 bg-white text-green-700 px-2 py-1 rounded shadow-sm text-[10px] font-bold hover:bg-green-100">
                  <Download size={12}/> Excel
                </button>
                {/* BOTÓN NUEVO DE PDF */}
                <button onClick={descargarPDF} className="flex items-center gap-1 bg-blue-600 text-white px-2 py-1 rounded shadow-sm text-[10px] font-bold hover:bg-blue-700">
                  <FileText size={12}/> PDF Resumen
                </button>
              </div>
            )}
          </div>
          <div className="p-6 flex-1">
            {resumenProductos.length > 0 && (
              <>
                <div className="flex items-center gap-4 mb-4 bg-slate-800 text-white p-4 rounded-lg shadow-md">
                  <Wine size={28} className="text-green-400" />
                  <div><p className="text-xs font-medium text-slate-400">Total reclamable</p><p className="text-3xl font-black">{totalBotellas} bot.</p></div>
                </div>
                <div className="overflow-y-auto max-h-[150px] space-y-1">
                  {resumenProductos.map((item, i) => (
                    <div key={i} className="flex justify-between text-xs p-2 bg-slate-50 border rounded">
                      <span className="truncate pr-2 font-medium">{item.descripcion}</span><span className="font-bold text-blue-700">{item.cantidad}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {datosExtraidos.length > 0 && (
        <div className="bg-slate-900 rounded-xl p-6 shadow-xl text-white animate-fade-in-up">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-blue-400"><LinkIcon size={20}/> 3. Vincular a Reclamación</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <select value={bodegaSel} onChange={(e) => {setBodegaSel(e.target.value); setAcuerdoSel(''); setReclamacionSel('');}} className="p-2 rounded bg-slate-800 border border-slate-700 text-sm uppercase">
              <option value="">-- Bodega --</option>
              {bodegasUnicas.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={acuerdoSel} onChange={(e) => {setAcuerdoSel(e.target.value); setReclamacionSel('');}} disabled={!bodegaSel} className="p-2 rounded bg-slate-800 border border-slate-700 text-sm disabled:opacity-30">
              <option value="">-- Cliente/Acuerdo --</option>
              {acuerdosDeBodega.map(a => <option key={a.id} value={a.id}>{a.cliente}</option>)}
            </select>
            <select value={reclamacionSel} onChange={(e) => setReclamacionSel(e.target.value)} disabled={!acuerdoSel} className="p-2 rounded bg-slate-800 border border-slate-700 text-sm disabled:opacity-30">
              <option value="">-- Periodo --</option>
              {reclamacionesDisponibles.map((r:any) => <option key={r.id} value={r.id}>{r.periodo}</option>)}
            </select>
          </div>
          <button onClick={vincularYGuardar} disabled={!reclamacionSel || guardando} className="w-full bg-blue-600 hover:bg-blue-500 py-3 rounded-lg font-bold flex justify-center items-center gap-2 transition disabled:bg-slate-700">
            {guardando ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            Vincular y Guardar en Nube
          </button>
        </div>
      )}

      {mensaje && <div className={`mt-6 p-4 rounded-lg border text-center font-bold ${mensaje.tipo === 'exito' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'}`}>{mensaje.texto}</div>}
    </div>
  );
}