// A realistic Canara Bank statement CSV (made-up account and people): account details at the
// top, the transaction table with Debit / Credit / Balance columns, and summary lines after it.
export const CANARA_CSV = [
  "Account Name,MR TEST USER",
  "Account Number,'XXXXXXXX5678",
  "IFSC Code,CNRB0001234",
  "Statement Period,01-10-2026 to 31-10-2026",
  "",
  "Txn Date,Value Date,Cheque No.,Description,Branch Code,Debit,Credit,Balance",
  ',,,Opening Balance,,,,"17,500.00"',
  '01-10-2026 09:12:44,01-10-2026,,UPI/CR/427512345678/ACME TECHNOLOGIES/HDFC/acme@hdfc/Salary,1234,,"85,000.00","1,02,500.00"',
  '02-10-2026 10:00:01,02-10-2026,,NEFT-HDFC0000123-SHARMA PROPERTIES-RENT OCT,1234,"25,000.00",,"77,500.00"',
  "05-10-2026 20:15:10,05-10-2026,,UPI/DR/427598765432/SWIGGY/YESB/swiggy@ybl/Order,1234,450.50,,\"77,049.50\"",
  "07-10-2026 08:30:00,07-10-2026,,UPI/DR/427511112222/BIGBASKET/ICIC/bigbasket@icici/Groceries,1234,\"2,310.00\",,\"74,739.50\"",
  "12-10-2026 18:45:00,12-10-2026,,UPI/DR/427533334444/NETFLIX/HDFC/netflix@hdfc/Monthly,1234,649.00,,\"74,090.50\"",
  "15-10-2026 07:05:00,15-10-2026,,UPI/DR/427555556666/CHAI POINT/SBIN/chai@sbi/Tea,1234,20.00,,\"74,070.50\"",
  "15-10-2026 07:06:00,15-10-2026,,UPI/DR/427555556666/CHAI POINT/SBIN/chai@sbi/Tea,1234,20.00,,\"74,050.50\"",
  "20-10-2026 13:00:00,20-10-2026,,BESCOM ELECTRICITY BILL PAYMENT,1234,\"1,840.00\",,\"72,210.50\"",
  "28-10-2026 11:11:11,28-10-2026,,ATM CASH WITHDRAWAL MG ROAD,1234,\"5,000.00\",,\"67,210.50\"",
  ',,,Closing Balance,,,,"67,210.50"',
  ',,,Total,,"35,290.00","85,000.00",',
  "",
  "This is a computer generated statement.",
].join("\n");
