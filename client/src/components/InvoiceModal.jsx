import React, { useState, useEffect } from 'react';
import api from '../services/api';

const InvoiceModal = ({ sale, onClose }) => {
    const [settings, setSettings] = useState({
        companyName: 'Apothecary POS',
        address: 'Medan, North Sumatra',
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data } = await api.get('/settings');
                if (data) {
                    setSettings(data);
                }
            } catch (error) {
                console.error("Could not fetch settings for invoice, using defaults.", error);
            }
        };
        fetchSettings();
    }, []);

    if (!sale) return null;

    const handlePrint = () => {
        const printContent = document.getElementById('invoice-print-area').innerHTML;
        const originalContents = document.body.innerHTML;

        document.body.innerHTML = `
            <html>
                <head>
                    <title>Print Invoice</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        @media print {
                            @page {
                                margin: 0;
                            }
                            body {
                                margin: 1.2cm;
                                -webkit-print-color-adjust: exact;
                                color-adjust: exact;
                            }
                            .print-container {
                                width: 100%;
                                max-width: 100%;
                                border: none;
                                box-shadow: none;
                            }
                        }
                        .print-container {
                            width: 100%;
                            max-width: 800px; /* A reasonable width for an invoice */
                            margin: auto;
                            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";
                        }
                    </style>
                </head>
                <body>
                    <div class="print-container p-4">
                        ${printContent}
                    </div>
                </body>
            </html>
        `;

        window.print();

        document.body.innerHTML = originalContents;
        window.location.reload();
    };

    return (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-xl flex flex-col">
                {/* Printable Area */}
                <div id="invoice-print-area" className="p-8">
                    {/* Header */}
                    <div className="flex justify-between items-start pb-4 border-b border-gray-200">
                        <div>
                            <h2 className="text-3xl font-bold text-gray-800">{settings.companyName}</h2>
                            <p className="text-sm text-gray-500">{settings.address}</p>
                        </div>
                        <div className="text-right">
                            <h3 className="text-2xl font-semibold text-gray-700">INVOICE</h3>
                            <p className="text-xs text-gray-500 break-all">ID: {sale._id}</p>
                        </div>
                    </div>

                    {/* Details */}
                    <div className="grid grid-cols-3 gap-x-8 gap-y-4 my-6 text-sm">
                        {/* Billed To */}
                        <div className="col-span-1">
                            <p className="text-gray-500 uppercase text-xs font-bold tracking-wider mb-1">Billed To</p>
                            {sale.customerId ? (
                                <>
                                    <p className="font-medium text-gray-800">{sale.customerId.name}</p>
                                    {sale.customerId.phone && <p className="text-gray-600">{sale.customerId.phone}</p>}
                                    {sale.customerId.address && <p className="text-gray-600">{sale.customerId.address}</p>}
                                </>
                            ) : (
                                <p className="font-medium text-gray-800">Walk-in Customer</p>
                            )}
                        </div>
                        
                        {/* Invoice Details */}
                        <div className="col-span-2 text-right">
                             <div className="grid grid-cols-2">
                                <span className="text-gray-500 font-medium">Date:</span>
                                <span className="font-medium text-gray-800">{new Date(sale.createdAt).toLocaleString('id-ID', { dateStyle: 'long', timeStyle: 'short' })}</span>
                                
                                <span className="text-gray-500 font-medium">Cashier:</span>
                                <span className="font-medium text-gray-800">{sale.cashierId.username}</span>
                                
                                <span className="text-gray-500 font-medium">Payment Method:</span>
                                <span className="font-medium text-gray-800">{sale.paymentMethod}</span>
                             </div>
                        </div>
                    </div>
                    
                    {/* Items Table */}
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-100 border-b border-gray-300">
                                <tr>
                                    <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wider">Product</th>
                                    <th className="px-4 py-3 text-center font-semibold text-gray-600 uppercase tracking-wider">Qty</th>
                                    <th className="px-4 py-3 text-right font-semibold text-gray-600 uppercase tracking-wider">Unit Price</th>
                                    <th className="px-4 py-3 text-right font-semibold text-gray-600 uppercase tracking-wider">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {sale.items.map(item => (
                                    <tr key={item._id}>
                                        <td className="px-4 py-3 whitespace-nowrap text-gray-800">{item.name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-center text-gray-600">{item.quantity}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right text-gray-600">Rp{item.price.toLocaleString('id-ID')}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-right font-medium text-gray-800">Rp{(item.price * item.quantity).toLocaleString('id-ID')}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end mt-6 pt-4 border-t border-gray-200">
                        <div className="w-full max-w-xs space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="font-semibold text-gray-600">Total</span>
                                <span className="text-xl font-bold text-gray-900">Rp{sale.totalAmount.toLocaleString('id-ID')}</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-center text-xs text-gray-500 mt-12">
                        <p>Thank you for your purchase!</p>
                    </div>
                </div>

                {/* Actions (Non-printable) */}
                <div className="bg-gray-50 px-6 py-4 flex justify-end items-center gap-3 rounded-b-lg print:hidden">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
                        Close
                    </button>
                    <button onClick={handlePrint} className="px-4 py-2 bg-sky-600 text-white text-sm font-medium rounded-md hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500">
                        Print Invoice
                    </button>
                </div>
            </div>
        </div>
    );
};

export default InvoiceModal;