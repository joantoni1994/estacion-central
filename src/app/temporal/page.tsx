'use client';
import { useState } from 'react';
import * as XLSX from 'xlsx';
import { UploadCloud, ArrowLeft, Loader2, AlertTriangle, Calculator, Settings2, FileSpreadsheet, Play, Trash2 } from 'lucide-react';

export default function AuditorMargenes() {
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState<{ texto: string; tipo: 'exito' | 'error' | 'info' } | null>(null);
  const [alertas, setAlertas] = useState<{ cliente: string; descripcion: string; precio: number; margen: number }[]>([]);

  const [umbral, setUmbral] = useState<number>(18);
  const [modo, setModo] = useState<'linea' | 'agrupado'>('linea');
  const [tipoDescarga, setTipoDescarga] = useState<'resumen' | 'detalle'>('resumen');
  const [incluirRegalos, setIncluirRegalos] = useState<boolean>(false);

  // Estado para guardar el Excel en la memoria temporal de la web
  const [archivoEnMemoria, setArchivoEnMemoria] = useState<{ nombre: string, filas: any[][] } | null>(null);

  const parsearNumero = (valor: any) => {
    if (typeof valor === 'number') return valor;
    let texto = String(valor || '').trim();
    if (!texto) return 0;
    let limpio = texto.replace(/\./g, '').replace(/,/g, '.');
    return parseFloat(limpio) || 0;
  };

  // PASO 1: CARGAR EL ARCHIVO EN MEMORIA
  const cargarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProcesando(true);
    setMensaje({ texto: 'Leyendo archivo e inyectando en memoria...', tipo: 'info' });
    setAlertas([]);

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

        setArchivoEnMemoria({ nombre: file.name, filas: filasBrutas });
        setMensaje({ texto: `✅ Archivo "${file.name}" listo. Configura los filtros y dale a Ejecutar Auditoría.`, tipo: 'exito' });
        setProcesando(false);

      } catch (error) {
        setMensaje({ texto: 'Error al leer el archivo.', tipo: 'error' });
        setProcesando(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // PASO 2: EJECUTAR LAS MATEMÁTICAS
  const ejecutarAuditoria = () => {
    if (!archivoEnMemoria) return;
    
    setMensaje({ texto: 'Calculando rentabilidades...', tipo: 'info' });
    setAlertas([]);
    
    try {
      const filasBrutas = archivoEnMemoria.filas;
      let filaCabeceras = -1;
      let colCliente = -1, colCodigo = -1, colDesc = -1, colTotal = -1, colCant = -1, colCoste = -1;

      for (let i = 0; i < filasBrutas.length; i++) {
        const fila = filasBrutas[i];
        if (!Array.isArray(fila)) continue;
        
        let tCli = -1, tCod = -1, tDesc = -1, tTot = -1, tCant = -1, tCoste = -1;
        
        fila.forEach((celda, index) => {
          const t = String(celda).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, ''); 
          
          if (t.includes('cliente') || t.includes('nom')) tCli = index;
          if (t.includes('codigo') || t.includes('cod')) tCod = index;
          if (t.includes('descrip') || t.includes('articulo') || t.includes('producto')) tDesc = index;
          if (t.includes('total') || t.includes('importe')) tTot = index;
          if (t === 'cant' || t.includes('cantidad') || t.includes('uds')) tCant = index;
          if (t.includes('costemedio') || t === 'coste') tCoste = index;
        });

        if (tCli !== -1 && tCod !== -1 && tDesc !== -1 && tTot !== -1 && tCant !== -1 && tCoste !== -1) {
          filaCabeceras = i; colCliente = tCli; colCodigo = tCod; colDesc = tDesc; colTotal = tTot; colCant = tCant; colCoste = tCoste; break;
        }
      }

      if (filaCabeceras === -1) {
        setMensaje({ texto: 'Faltan columnas vitales en el Excel cargado.', tipo: 'error' });
        return;
      }

      const umbralDecimal = umbral / 100;
      const listaAlertas: { cliente: string; descripcion: string; precio: number; margen: number }[] = [];
      let filasExportar: any[][] = [];

      if (modo === 'linea') {
        filasExportar.push(filasBrutas[filaCabeceras]); 
        for (let i = filaCabeceras + 1; i < filasBrutas.length; i++) {
          const fila = filasBrutas[i];
          if (!fila || fila.length === 0) continue;
          
          const total = parsearNumero(fila[colTotal]);
          const cant = parsearNumero(fila[colCant]);
          const costeMedio = parsearNumero(fila[colCoste]);
          
          if (cant > 0 && (total > 0 || incluirRegalos)) {
            const precioUnitario = total / cant;
            const margen = precioUnitario > 0 ? (precioUnitario - costeMedio) / precioUnitario : -1;
            
            if (margen < umbralDecimal) {
              filasExportar.push(fila); 
              listaAlertas.push({ cliente: String(fila[colCliente]), descripcion: String(fila[colDesc]), precio: precioUnitario, margen: margen });
            }
          }
        }
      } else {
        const grupos: Record<string, any> = {};
        for (let i = filaCabeceras + 1; i < filasBrutas.length; i++) {
          const fila = filasBrutas[i];
          if (!fila || fila.length === 0) continue;
          
          const total = parsearNumero(fila[colTotal]);
          const cant = parsearNumero(fila[colCant]);
          const costeMedio = parsearNumero(fila[colCoste]);
          const cliente = String(fila[colCliente]).trim();
          const codigo = String(fila[colCodigo]).trim();
          const desc = String(fila[colDesc]).trim();
          
          if (cant > 0 && (total > 0 || incluirRegalos)) {
            const clave = `${cliente}|||${codigo}`;
            if (!grupos[clave]) grupos[clave] = { cliente, codigo, desc, totalVentas: 0, totalCostes: 0, cant: 0, filasOriginales: [] };
            
            grupos[clave].totalVentas += total;
            grupos[clave].cant += cant;
            grupos[clave].totalCostes += (costeMedio * cant); 
            grupos[clave].filasOriginales.push(fila);
          }
        }

        if (tipoDescarga === 'resumen') {
          filasExportar.push(["Cliente", "Código", "Descripción", "Unidades Totales", "Importe Total", "Precio Medio", "Coste Medio Global", "Margen %"]);
        } else {
          filasExportar.push(filasBrutas[filaCabeceras]);
        }

        Object.values(grupos).forEach(g => {
          const precioMedio = g.totalVentas / g.cant;
          const costeMedioGlobal = g.totalCostes / g.cant;
          const margen = precioMedio > 0 ? (precioMedio - costeMedioGlobal) / precioMedio : -1;

          if (margen < umbralDecimal) {
            listaAlertas.push({ cliente: g.cliente, descripcion: g.desc, precio: precioMedio, margen: margen });
            if (tipoDescarga === 'resumen') {
              filasExportar.push([
                g.cliente, g.codigo, g.desc, g.cant, g.totalVentas, 
                precioMedio.toFixed(2), costeMedioGlobal.toFixed(2), (margen * 100).toFixed(2) + '%'
              ]);
            } else {
              filasExportar.push(...g.filasOriginales);
            }
          }
        });
      }

      listaAlertas.sort((a, b) => a.margen - b.margen);
      if (filasExportar.length <= 1) {
        setMensaje({ texto: `Ningún margen por debajo del ${umbral}%. (Puedes cambiar los filtros y volver a probar).`, tipo: 'exito' });
        return;
      }

      const nuevaHoja = XLSX.utils.aoa_to_sheet(filasExportar);
      const nuevoLibro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(nuevoLibro, nuevaHoja, "Margenes_Bajos");
      XLSX.writeFile(nuevoLibro, `Auditoria_${modo}_${new Date().toISOString().split('T')[0]}.xlsx`);

      setAlertas(listaAlertas);
      setMensaje({ texto: `Atención: ${listaAlertas.length} alertas encontradas. Excel descargado. (Puedes volver a auditar sin subir de nuevo).`, tipo: 'error' });

    } catch (error) {
      setMensaje({ texto: 'Error al calcular. Revisa los datos.', tipo: 'error' });
    }
  };

  // PASO 3: BORRAR LA MEMORIA
  const limpiarMemoria = () => {
    setArchivoEnMemoria(null);
    setAlertas([]);
    setMensaje(null);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-bold text-slate-800">Auditor de Márgenes</h1>
        <p className="text-slate-500 mt-1">Detecta ventas no rentables con cálculos en memoria.</p>
      </div>

      <div className="bg-white p-5 rounded-xl border shadow-sm mb-6 flex flex-col md:flex-row gap-6 items-start">
        <div className="flex items-center gap-3 shrink-0">
          <Settings2 size={24} className="text-slate-400 mt-4" />
          <div className="w-24">
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Umbral (%)</label>
            <input type="number" value={umbral} onChange={(e) => setUmbral(Number(e.target.value))} className="w-full border-2 border-slate-200 rounded p-1.5 font-bold focus:border-red-400 outline-none" />
          </div>
        </div>
        
        <div className="flex-1 border-l border-slate-100 pl-6">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Modo de Análisis</label>
          <div className="flex flex-wrap gap-3 mb-3">
            <button onClick={() => setModo('linea')} className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition ${modo === 'linea' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-100 text-slate-500'}`}>Línea a Línea</button>
            <button onClick={() => setModo('agrupado')} className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition ${modo === 'agrupado' ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-100 text-slate-500'}`}>Agrupado (Cliente + Producto)</button>
          </div>
          
          <label className="flex items-center gap-2 cursor-pointer p-2 bg-slate-50 rounded-lg border border-slate-200 hover:bg-slate-100 transition w-fit">
            <input type="checkbox" checked={incluirRegalos} onChange={(e) => setIncluirRegalos(e.target.checked)} className="accent-red-600 w-4 h-4 cursor-pointer" />
            <span className="text-xs font-bold text-slate-700">Incluir botellas sin cargo (Total = 0€) en la media</span>
          </label>
        </div>

        {modo === 'agrupado' && (
          <div className="flex-1 border-l border-slate-100 pl-6 animate-fade-in-up">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Exportación</label>
            <select value={tipoDescarga} onChange={(e) => setTipoDescarga(e.target.value as 'resumen' | 'detalle')} className="w-full p-2 border border-slate-200 rounded text-sm font-bold text-slate-700 outline-none focus:border-red-400">
              <option value="resumen">Resumen Simplificado</option>
              <option value="detalle">Detallado Factura a Factura</option>
            </select>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* ZONA SUBIDA / EJECUCIÓN */}
        <div className="bg-white p-8 rounded-xl border-2 border-dashed border-red-200 text-center flex flex-col justify-center min-h-[250px] shadow-sm">
          {procesando ? (
            <Loader2 size={40} className="text-red-600 animate-spin mx-auto" />
          ) : !archivoEnMemoria ? (
            <div className="animate-fade-in">
              <Calculator size={40} className="text-red-600 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Paso 1: Cargar Excel</h3>
              <p className="text-slate-500 mb-6 text-sm px-4">Sube el archivo para cargarlo en memoria.</p>
              <label className="cursor-pointer bg-slate-800 hover:bg-slate-700 text-white px-8 py-3 rounded-lg font-bold shadow-lg transition flex items-center justify-center gap-2 max-w-xs mx-auto">
                <UploadCloud size={20} /> Seleccionar Excel
                <input type="file" accept=".xlsx, .xls, .csv" className="hidden" onChange={cargarArchivo} onClick={(e) => { (e.target as HTMLInputElement).value = ''; }} />
              </label>
            </div>
          ) : (
            <div className="animate-fade-in flex flex-col items-center">
              <div className="bg-green-100 p-3 rounded-full mb-3">
                <FileSpreadsheet size={32} className="text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Archivo en memoria</h3>
              <p className="text-sm text-slate-500 font-medium mb-6 bg-slate-50 border px-3 py-1 rounded truncate max-w-[200px]">{archivoEnMemoria.nombre}</p>
              
              <div className="flex flex-col w-full max-w-xs gap-3">
                <button onClick={ejecutarAuditoria} className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg transition flex items-center justify-center gap-2">
                  <Play size={20} /> Ejecutar Auditoría
                </button>
                <button onClick={limpiarMemoria} className="bg-white border-2 border-slate-200 text-slate-600 hover:bg-slate-50 px-6 py-2 rounded-lg font-bold transition flex items-center justify-center gap-2">
                  <Trash2 size={18} /> Cerrar y Eliminar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ZONA RESUMEN ALERTAS */}
        <div className={`bg-white rounded-xl border shadow-sm overflow-hidden ${alertas.length > 0 ? 'border-red-300' : 'opacity-40'}`}>
          <div className="p-4 bg-red-50 text-red-800 font-bold flex justify-between">
            <span>Alertas detectadas</span>
            {alertas.length > 0 && <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-xs">{alertas.length}</span>}
          </div>
          <div className="max-h-[300px] overflow-y-auto">
            {alertas.length > 0 ? (
              alertas.map((alerta, i) => (
                <div key={i} className="p-3 border-b text-sm hover:bg-red-50/30">
                  <div className="flex justify-between font-bold text-slate-800">
                    <span className="truncate pr-2">{alerta.cliente}</span>
                    <span className="text-red-600">{(alerta.margen * 100).toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span className="truncate pr-4">{alerta.descripcion}</span>
                    <span>{alerta.precio.toFixed(2)}€/ud</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-8 text-center text-slate-400">
                <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay alertas. Carga un archivo y haz clic en Ejecutar.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {mensaje && (
        <div className={`mt-6 p-4 rounded-lg border font-medium text-center shadow-sm animate-fade-in-up
          ${mensaje.tipo === 'exito' ? 'bg-green-50 border-green-200 text-green-800' : 
            mensaje.tipo === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 
            'bg-blue-50 border-blue-200 text-blue-800'}`}>
          {mensaje.texto}
        </div>
      )}
    </div>
  );
}