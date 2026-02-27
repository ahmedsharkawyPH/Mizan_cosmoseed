
import html2canvas from 'html2canvas';
// @ts-ignore
import { jsPDF } from 'jspdf';
// @ts-ignore
import toast from 'react-hot-toast';

export async function generatePriceListPdf(products: any[], settings: any, priceType: 'retail' | 'wholesale' | 'half_wholesale' = 'retail') {
    const toastId = toast.loading("جاري تحضير تقرير PDF...");
    
    products.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const itemsPerPage = 160; 
    const chunks: any[][] = [];
    for (let i = 0; i < products.length; i += itemsPerPage) {
        chunks.push(products.slice(i, i + itemsPerPage));
    }

    const priceTypeLabel = priceType === 'wholesale' ? 'جملة' : priceType === 'half_wholesale' ? 'نص جملة' : 'قطاعي';

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    
    try {
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            const pageDiv = document.createElement('div');
            pageDiv.style.width = '210mm';
            pageDiv.style.padding = '10mm';
            pageDiv.style.background = 'white';
            pageDiv.style.direction = 'rtl';
            pageDiv.style.fontFamily = 'Cairo, sans-serif';
            pageDiv.style.position = 'fixed';
            pageDiv.style.top = '-10000px'; 
            
            pageDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 8px; margin-bottom: 15px;">
                    <div>
                        <h1 style="margin: 0; font-size: 18px; font-weight: 900;">${settings.companyName}</h1>
                        <p style="margin: 2px 0 0 0; font-size: 11px; color: #666;">تقرير الأسعار (${priceTypeLabel})</p>
                    </div>
                    <div style="text-align: left;">
                        <p style="margin: 0; font-size: 9px;">تاريخ: ${new Date().toLocaleDateString('ar-EG')}</p>
                        <p style="margin: 2px 0 0 0; font-size: 9px; color: #999;">صفحة ${i + 1} من ${chunks.length}</p>
                    </div>
                </div>
                <div style="column-count: 2; column-gap: 15px; column-rule: 1px dashed #ddd;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="background: #f8fafc; border-bottom: 2px solid #333;">
                                <th style="padding: 4px; text-align: right; font-size: 9px; border: 1px solid #ddd;">الصنف</th>
                                <th style="padding: 4px; text-align: center; font-size: 9px; border: 1px solid #ddd; width: 55px;">السعر</th>
                                <th style="padding: 4px; text-align: center; font-size: 9px; border: 1px solid #ddd; width: 45px;">الكود</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${chunk.map(p => `
                                <tr style="border-bottom: 1px solid #eee; break-inside: avoid;">
                                    <td style="padding: 4px; font-size: 9px; font-weight: bold; border: 1px solid #f9f9f9;">${p.name}</td>
                                    <td style="padding: 4px; text-align: center; font-size: 9px; font-weight: 900; color: #2563eb; border: 1px solid #f9f9f9;">${(p.display_selling_price || p.selling_price || 0).toLocaleString()}</td>
                                    <td style="padding: 4px; text-align: center; font-size: 7px; color: #aaa; font-family: monospace; border: 1px solid #f9f9f9;">${p.code || '-'}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            `;
            document.body.appendChild(pageDiv);
            const canvas = await html2canvas(pageDiv, { scale: 1.5, useCORS: true, backgroundColor: '#ffffff' });
            const imgData = canvas.toDataURL('image/jpeg', 0.9); 
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
            document.body.removeChild(pageDiv); 
        }
        pdf.save(`Inventory_Report_${new Date().toISOString().split('T')[0]}.pdf`);
        toast.success("تم تصدير التقرير بنجاح", { id: toastId });
    } catch (err) {
        toast.error("فشل تصدير PDF", { id: toastId });
    }
}
