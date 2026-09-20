/**
 * Regression on REAL on-device OCR output (PP-OCRv4 / RapidOCR text dumps of the receipt
 * screenshots and photos shared by the user) — not hand-typed text.
 *
 * PP-OCRv4 has no ₹ glyph: ₹1,000 → "71000", ₹10 → "210"/"710", ₹164 → "#164", ₹400 → "天400",
 * ₹20,000 → "R20,000". Words get glued ("Paidto", "Collectedamount", "18,000MMK") and values
 * often land on the line before their label. `repairOcrText` must undo all of that.
 *
 * Run: npx tsx scripts/test-real-ocr-samples.ts
 */
import { extractMoneyAmount, extractMoneyEntries } from '../src/lib/amount-parse.ts';

type Case = { id: string; want: number[]; merchant?: string; note?: string; skip?: string; text: string };

const cases: Case[] = [
  {
    id: "01_1000440583",
    want: [182961],
    merchant: "CRED",
    note: "CRED, \"amount\" label garbled to \"srent\", ₹→T",
    text: "42100b8c-cedb-438...\n☆回\nCRED\nbillpayment receipt\nordor ID\nZE1Q6VQPE1W\nroheronce 3t\nDP316241XAYA2CSNEGHDT\n29 Aug, 2026 0:34 AN\nsrent\nT182961\npeyestimePod\nUPI\nbiller account details\nIndusind\nbiler niene\nBank\ncabagery\nCREDITCARD\nGntimer 10\nXX0X-0600",
  },
  {
    id: "02_1000440684",
    want: [1000],
    merchant: "Nunna Mahesh",
    note: "PhonePe ₹1,000 read as \"71000\"",
    text: "11:461\n80\nTransaction Successful\n19September2026at10:00PM\nPaid to\nNunnaMaheshCar\n71000\n+919966021112\nBankingname:MrNMAHESH\nPaymentDetails\nPhonePe Transaction ID\nT2609192200093015473931\nDebited from\nBadrinath\n1,000\nUTR:129370881060\nSendAgain\nViewHistory\nSplit Expense\nShare Receipt\nContactPhonePeSupport\nPowered by\nUPI\n205ept2026.11:46am",
  },
  {
    id: "03_1000440584",
    want: [],
    skip: "handwritten chit photographed sideways — native rotation retry covers it",
    text: "16Sept2026,1:44pm",
  },
  {
    id: "04_1000440588",
    want: [100000],
    merchant: "RBL",
    text: "bbda7852-0752-490...\nCRED\nbill paymentreceipt\norder ID\n2D4ZWYX0NYVN\ntransaction\nreference id\nDP316244OS8FUQ06MNGM\n1 Sep, 2026 6:50\ndate\nAM\namount\n100000\npaymont method\nUPI\nbiller account details\nRBL\nblier neme\nBank\ncatogory\nCREDITCARD\nCustomer ID\nXXXX-7452\npsid via. CRED app (Dreaimplug Technologies Pvt. Lts)",
  },
  {
    id: "05_1000440587",
    want: [100000],
    merchant: "RBL",
    text: "bbda7852-0752-490...\nCRED\nbill paymentreceipt\norder ID\n2D4ZWYX0NYVN\ntransaction\nreference id\nDP316244OS8FUQ06MNGM\n1 Sep, 2026 6:50\ndate\nAM\namount\n100000\npaymont method\nUPI\nbiller account details\nRBL\nblier neme\nBank\ncatogory\nCREDITCARD\nCustomer ID\nXXXX-7452\npsid via. CRED app (Dreaimplug Technologies Pvt. Lts)",
  },
  {
    id: "06_1000440556",
    want: [18685.04],
    merchant: "ICICI",
    text: "a17be2ef-46b8-4a74...\nCRED\nbill payment receipt\norder ID\n2WG1L52256Z3\ntransaction\nreference id\nDP015238155824oCyYRb\n26Aug,20253:58PM\ndate\namount\n18685.04\npaymentmethod\nUPI\nbilleraccountdetails\nICICI\nBank\nbiller name\ncategory\nCREDITCARD\nCustomer ID\nXXXX-5008\npaid via CRED app (Dreamplug Technologies Pvt. Ltd.)",
  },
  {
    id: "07_1000440506",
    want: [550],
    merchant: "SCHANDBASHA",
    text: "TransactionSuccessful\n11September2026at10:10AM\nPaid to\nSCHANDBASHA\n550\nVyapar.********0112@hdfcbank\nPayment Details\nPhonePe TransactionID\nT2609111010139321346957\nDebited from\nNagaveni\n550\nUTR:493604088625",
  },
  {
    id: "08_1000440582",
    want: [182961],
    merchant: "INDUSIND",
    note: "\"amourt ¶ 7182961\"",
    text: "42100b8c-cedb-438...\nCRED\nbill payment receipt\nZE1Q6VQPE1W\norder ID\nrelererce id\ntransaction\nDP316241XAYA2C5MXHDT\ndite\n29 Aug, 2026 8:34 AM\namourt\n7182961\npoau lusxuled\nUPI\nbiller account details\nIndusind\nilr neme\nBank\ncategory\nCREDIT CARD\nXXXX-0600\nCustomer ID\npac sia (RED app (Draaepug Teihrssgias PVt.L8)",
  },
  {
    id: "09_1000440553",
    want: [18685.04],
    merchant: "ICICI",
    text: "a17be2ef-46b8-4a74...\nCRED\nbill paymentreceipt\norder ID\n2WG1L52256Z3\ntransaction\nrelorence id\nDP015238155824oCyYRb\ndate\n26 Aug, 2025 3:58 PM\nancunt\n18685.04\npayment metiod\nUPI\nbiller account details\nICICI\nbter na/m)\nBank\ncalegory\nCREDIT CARD\nCustome ID\nXXXX-5008\nFait ca CRED asD (Orunpug Tecrocgies Pvt Ld)",
  },
  {
    id: "10_1000440555",
    want: [18685.04],
    merchant: "ICICI",
    text: "a17be2ef-46b8-4a74...\nCRED\nbill payment receipt\norder ID\n2WG1L52256Z3\ntransaction\nreference id\nDP015238155824oCyYRb\n26Aug,20253:58PM\ndate\namount\n18685.04\npaymentmethod\nUPI\nbilleraccountdetails\nICICI\nBank\nbiller name\ncategory\nCREDITCARD\nCustomer ID\nXXXX-5008\npaid via CRED app (Dreamplug Technologies Pvt. Ltd.)",
  },
  {
    id: "11_1000440553__1_",
    want: [18685.04],
    merchant: "ICICI",
    text: "a17be2ef-46b8-4a74...\nCRED\nbill paymentreceipt\norder ID\n2WG1L52256Z3\ntransaction\nrelorence id\nDP015238155824oCyYRb\ndate\n26 Aug, 2025 3:58 PM\nancunt\n18685.04\npayment metiod\nUPI\nbiller account details\nICICI\nbter na/m)\nBank\ncalegory\nCREDIT CARD\nCustome ID\nXXXX-5008\nFait ca CRED asD (Orunpug Tecrocgies Pvt Ld)",
  },
  {
    id: "12_1000440474",
    want: [400],
    merchant: "RONTE VENKANNA",
    note: "GPay ₹ read as 天; balance 59,08,743 must lose",
    text: "59,08,743\nRONTE VENKANNA\n天400\n12 Sept,10:42pm·L-/\nView details\nCheckbalance\nEXPIRESIN7DAYS\nrewardunlocked\nclaimR10cashback\nClaimnow",
  },
  {
    id: "13_RESTO_BILL",
    want: [1864.4],
    merchant: "HARISHANKER",
    text: "HARISHANKERVEGRESTO\nTRIVENI NAGARGOPALPURA,JAIPUR\nCash Memo\nDate:19/04/2025\nBill No.:1925\nT.No.: 5\nW. No. :\nQty\nRate\nParticulars\nAmount\nHANDIPANEER\n#200\n￥400\nSEVTAMATAR\n￥150\n300\nPLAINRAITA\n220\nJEERARICE\n220\nTAVAROTIBUTTER\n10\n120\nTANDURIROTIBUTTER\n2120\nVANILA ICECREAM\n±40\n200\nSub Total:\n1580.00\nCGST@9%On?1580.00:\n142.20\nSGST@9%On?1580.00:\n142.20\nFood Total:\n?1864.4\nTotal :\n1864.4\n(01:01 PM)\nE.&O.E.\nThank You\nVisit Again",
  },
  {
    id: "14_Create_Fake_Receipt_Online___Free_Fake_R",
    want: [309],
    merchant: "IndianCurryPlace",
    text: "IndianCurryPlace\n1468TANGLEWOODROAD\nMEMPHIS,MS\nTEL:0943452252\nRECEIPT\n564\nDATE\n25/02/2021\nTIME\n10:50AM\nMeggan\nHOST\nCash\nPAYMENTMETHOD\nQTY\nITEM\nAMT.($)\nPaneerCurry\n$89\nChickenCurry\n$120\nEggCurry\n$100\nSUB-TOTAL\n$309\nTax\n$0.00\nAMT:\n$309.00\nTHANKSFORVISIT",
  },
  {
    id: "15_1019995015575767758",
    want: [],
    skip: "OCR misreads handwritten 7800 as 17800 — engine limitation",
    text: "Sen Enterprise\nComposit Dealer\nsuloonBeauty Parlour.\n289\nremArwholesaleRate\nInvoice No.:\nQ12615：\nName\nState:Gujarat\nGSTIN\nCode:24\nCode:\nAmount\nState\nRate\nHSN Code\nQty.\nNo.\nParticulars\n26004\ntechlpetoumen\n4200\nIinimmes\n17800\nTOTAL\nRupees\nSHREESENFForepiiotegrise\nSubject to Rajkot Jurisdiction\nE.&O.E.",
  },
  {
    id: "16_485755509829107305",
    want: [1381],
    merchant: "Summer Town",
    text: "Summer Town Resto Cafe\nDuplicate\nHB73,4th Cross Road,Panampily\nNagar\n32AEWFS3312RIZD\nMOB.+916238023241\nsummertowncafe@gmail,com\nAssigrtu:hanu\nToken No.:8, 9\nPrice Amount\nQty.\n1 445.00 445.00\nItem\n20.00\nCheesy Bbq\n120.00\n1 200.00 200.00\nChicken Pizza\nMineral Water\n1200.00 200.00\nIced Caramel\n1 200.00 200.00\n1 250.00 250.00\nLatte\nIrish Coffee\nSpanish Latte\nStrawberry Lotus\nSub1315.00\nTotal Qty:6 Total\n32.88\nShake\nCGST2.5%\n32.88\nSGST2.5%\n+0.24\nGrandTotal1381.00\nRound off\nFSSAI LicNo.21322188001372\nThanks",
  },
  {
    id: "17_841469511670489553",
    want: [590],
    merchant: "IndianOil",
    text: "IndianOil\nWelcomes You\nSTART NELL\n178,NSCBOSEROAD\nK0LKATA700040\nTel.No.:9830036977\nInv.No:44210663640507662\nFCC ID:00000000028547870\nFIP No.\n: 01\nNozzleNo.:03\nProduct\n: Petrol\nDensity:752.7Kg/Cu.mtr\nPreset Type: Amount\nRate(Rs/L)\n105.45\nVolume(L)\n:00005.60\nAmount(Rs)\n:00590.00\nVech:00182263484.01\nVtrd:0001730171.270\nVehicle No: 5852\nMobile No : Not Entered\nDate:06/05/26\nTime :11:28\nGST No:\nLST No:\nVAT No:\nThank You! Please Visit\nAgain..",
  },
  {
    id: "18_111041947057956956",
    want: [],
    skip: "GRAND TOTAL value not present in OCR output (38512 = pre-tax total)",
    text: "PAEOASTHOEUSU\nGSTIN:37BRNPM0260R1Z4TAXINVOICE\nCell:9445415177\nMURUGESH TRADERS\nG.N.T.Road,Karur Village,Tada Mandal.\nSPSRNelloreDistrict,AP-524401\nBill No:\n835\nDate:...\nName& Adress.....\nSa...ba.bj...oghaosho..\nGSTIN:33AQEPK619ITIZ0\nAmount\nS.No.\nParticulars\nQty\nRate\nRs.\n19512656\n38512\nCo\nTOTAL\n38512\nCGST\n%：\nSGST\n%:\nIGST18\n10783\nThanhing You\nGRANDTOTAL\nFOr.MURUGESHTRADERS",
  },
  {
    id: "19_459507968226909839",
    want: [37],
    merchant: "INDIA GATE",
    text: "INDIA GATE\nDELICIOUS PUNJABI S.L.\nCalle Gerona, 2\n03503\nBenidorm\nSpain\nCIF:B54985940\nOperation Hours (Daily):\n6:00PM ti1 MIDNIGHT\nCurrent Bill\nR.No:IG016501\nDate:29.04.2018 23:12:55\nTransaction by: Sonu\nTable: 10\nPax:2\nNo Description\nAmt (e)\nCHICKEN PAKORA\n5,00\nLAMB\nTIKKA MASSALA\n11,50\nCHICKEN KARAI\n800\nRICE\n2.50\nBOTTLE HOUSE WINE\n10,00\nSubtotal(8)\n37,00\nIVA\n6,42\nTotal\n37,00\nWe Hope You Enjoyed Your Meal\nFind Us On Facebook and Trip Advisor\nPowered by Mob1POS\nwww.mob1-pos.com",
  },
  {
    id: "20_373798837845928241",
    want: [16750],
    note: "Rs8.300.00 dot-thousands; Total Rs 16.750.00 value-before-label",
    text: "MoadurantakKanhipurmDiscMallmaanll@mail.\n(Affiliated toUniversityof Madras)\nRECEIPT\nReceipt No.\n143\n21.08.2020\nDate\nStudent Name\nRegistration No.\n101501\nBranch& Year\nB.COM.(G)A2020-1stYear\nSemester\nSemester\nAmount(Rs.)\nSI, No.\nDetails\nTuition Fees\nRs8.300.00\nCitizen Consurner Club Fees\nRs.50.00\nRs.150.00\nID Card Fees\nRs.60.00\ninsurance Fees\nLibrary Fees\nRs.100.00\nRs.100.00\nNSS&YRCFees\nRs.200.00\nSports Fees\nRs.100.00\nStationery Fees\nTraining &PlacementFees\nRS.300.00\nRs.390.00\n10\nUniversity Fees\nRS.7,000.00\nBusFee(Route:THANGAL)\n11\nNo-2\nConusem5270\nRs.16.750.00\nTotal Rs\nhundredfifty only\nMode ofPayment\nCheque/DD\nCheque/ DD No.\n042100\nCentral Bank of Indiar\nBank Name&Branch\nCheque/DDDate\n21.08.2020\nCASHIER",
  },
  {
    id: "21_264727284330241799",
    want: [],
    skip: "Hindi handwritten estimate — unreadable by Latin/Chinese engines",
    text: "ESITMATE\nMob.-9425476812\nfa-io.5.3.02...\n13364\n(5632)-1902774105\n11000\n21p0424)-（2555)\n13\n(0064)",
  },
  {
    id: "22_1072701205017259954",
    want: [],
    note: "blank Amount(Rs) — must NOT return Atot meter",
    text: "IndianOil\nWelcomes You\nMAHIMAI AGENCY\nFIP No.\nNozzle No.:02\n:02\nProduct\n:Diesei\nPreset Type: Volume\nRate(Rs/L）:\n092.41\nVolume(L):\nAmount(Rs）：\nAtot:00021269861.36\nvtot:0000230458.010\nVehicle No:\nMobile No : Not Entered\nDate :\n102/26\nTime:22:06\nCST No:\nLST No: C5C7C\nVAT NO:\nThank You! Please Visit\nAgain..",
  },
  {
    id: "23_gmail_images20260920_174500",
    want: [30,150,1000,10,80],
    merchant: "SCHAND BASHA",
    note: "PhonePe history, ₹→7 / #",
    text: "5:451\n11 5G60\nHistory\n@MyStatements\nSearchtransactions\nSep2026\n1,54,010.75\nPald to\nSCHAND BASHA\n730\nZhoursago\nDebited from \nPaid to\nSCHAND BASHA\n#150\nZhours ago\nDebited fromC\nPaid to\nNunnaMaheshCar\n1,000\nYesterday\nDeblted from \nPaid to\nSharadha Medicals\n10\nYesterday\nDebited from\nPaid to\nJAYALAKSHMIMEDICALANDGE...\n780\nDebited fron O\nHome\nSearch\nAerts\nHistory\n20 5ept 2026.5:45pm",
  },
  {
    id: "24_gmail_images20260920_174446",
    want: [10],
    merchant: "Sharadha Medicals",
    note: "₹10 read as 210 & 710",
    text: "5:441\n5G\nTransactionSuccessful\n19Seotember2026at957PM\nPaidto\nSharadhaMedicals\n210\nQ135994664@ybl\nPayment Details\nPhonePeTransactionID\nT2609192157196424876447\nDebitedfrom\nBadrinath\n710\nUTR:308464448116\nSnare Receipt\nPay Again\nView Hiatory\nContactphor\nePe Support\n20 Sept 2026. 5:44 pm",
  },
  {
    id: "25_gmail_images20260920_174511",
    want: [164],
    merchant: "APOLLOPHARMACY",
    text: "5:451\n115G60\nTransaction Successful\n18September2026at9:04PM\nPaid to\nAPOLLOPHARMACY\nAPOLLOPHARMACYOFFLINE@ybI\n164\nPaymentDetails\nMessage\nPaymentfor154561300016544539\nPhonePe Transaction ID\nT2609182104039831994632\nDebited from\nBadrinath\n#164\nUTR:590641031504\nViewHistory\nSplitExpense\nShareReceipt\nContactPhonePeSupport\nPowered Dy\nUPI\n20 5et 2026.5:45 pm",
  },
  {
    id: "26_612278511881972551",
    want: [15],
    merchant: "MUHAMMADHELMI",
    text: "Paymentsuccessful\nRM15.00\nMUHAMMADHELMIBINMOHDISA\nReferenceID\n05556064\nDate&time\n31Mar2024,3:43PM\nTransactiontype\nScan&Pay\nShareReceipt\nDone",
  },
  {
    id: "27_847591592412123548",
    want: [190],
    merchant: "Breadfast",
    note: "#2020-00108289 order no must not become ₹",
    text: "3:26\n759\nReceipt-45088230\nDone\n巴1of1\nBreadfast\nOrder number: #2020-00108289\nThank you for ordering from Breadfast.\nProduct\nQty Prioe\nTotal\nNefertoot Raspberies (125g)\n1 160.00\n160.00\nSubtotal:\nEGP 160.00\nDelivery:\nEGP 25.00 s\nDohvery\nService Fees:\nEGP 5.00\nPayment method:\nCash On\nDelivery\nTotal:\nEGP 190.00\nEPacidadinetu\nnouranyasser\nDelivery Date\nNew Cairo\n21 October, 2025\nDelivery Time\n12:00 AM - 01:00 AM\nYou can reach our Customer Experience team through the app chat or email at: cx@breadfast.com\nwww.breadfast.com\nCommercial Register: 101472\nTax ID: 538-096-330",
  },
  {
    id: "28_587790188911659755",
    want: [20000],
    merchant: "Pushpa",
    note: "₹→R",
    text: "Paytm\nPAYMENTRECEIPT\nPaymentSuccessful\nR20,000\nRupees Twenty Thousand Only\nTo: Pushpa.\npaytm\nBank\nA/cXX6300\nFrom:ChakshuRaghuvanshi\npaytm\nBank\nPaytmPaymentsBankA/cXX1537\nIMPSRefID:2204H503hLYJ\n13ct,03:18PM\n1OO%SECUREPAYMENTS",
  },
  {
    id: "29_874331715163330555",
    want: [2687],
    merchant: "PIPALSINGH",
    text: "CashPaymentsCollected\nPIPALSINGH\nReceipt No.\nM150865015\nLAN\nP31JPRP7209792\nReceipt Date\n21-06-202505:43:50PM\nTotal Payment\n2687.00\nEMICollected\n0.00\nCharges Collected\n天0.00\nPayment Source\nCASH\n95******50 (SMS Initiated)\nRegistered Mobile\nNo.\nNA\nAlternateMobileNo.\nNPS Eligible\nYes\nNPSReceived\nNo",
  },
  {
    id: "30_667517976064614056",
    want: [1600],
    merchant: "DANIYALJAMEEL",
    text: "upaisa\nTransaction Successful\nTransaction Receipt\nTransaction ID:\n354116275541\nDate:\n10/01/202600:12\nTransaction Type:\nOtherWallets\nReceiver Name:\nDANIYALJAMEEL\nBank:\nEasypaisaBankLimited\nReceiverA/CNo:\n03336667163\nAmount:\nRs.1,600\nFee:\nRs.0\nTotal Amount:\nRs.1,600",
  },
  {
    id: "31_754915956283414928",
    want: [50],
    merchant: "GoodenGates",
    note: "no ₹ at all; \"rs\" inside PRIYADHARSHINISR must not count as currency",
    text: "50\nPaid to\nGoodenGates\nAgathiyanEssay-DreamIndia\nCompetition\nPaid50\nSep30,2020·8:19AM\nUPItransactionID\n027408475429\nTo\n.6390\nFrom:PRIYADHARSHINISR(StateBankofIndia)\npriyausend@oksbi\nGoogletransactionID\nCICAgKC1puHfUg\nPaymentsmaytakeupto3workingdays\ntobereflectedinyouraccount.Checkyour\noryourrecipient'sbankstatementforthe\nlateststatusofyourtransaction.Learn\nmore\nG Pay",
  },
  {
    id: "32_615374736611847710",
    want: [5049],
    merchant: "MUNNAKUMAR",
    note: "\"5049.0 ¶ Collectedamount\" value before glued label",
    text: "Jaiiuary,S.ip\nRECEIPTS\nTVSCREDIT\nReceiptof Collection\nAgreement no\nBR3058TW0222211\nCustomername\nMr.MUNNAKUMAR\nReceiptno\n100023\nReceiptdate\n04-11-202314_48\n5049.0\nCollectedamount\nCollectedamount\nfivethousand forty\nnine rupees only\nin words\nModeof payment\nCash\nCollectorID\n6018815\nNandanKumar\nCollectorName\nSingh",
  },
  {
    id: "33_Create_Fake_Receipt_Online___Free_Fake_R",
    want: [309],
    merchant: "IndianCurryPlace",
    text: "IndianCurryPlace\n1468TANGLEWOODROAD\nMEMPHIS,MS\nTEL:0943452252\nRECEIPT\n564\nDATE\n25/02/2021\nTIME\n10:50AM\nMeggan\nHOST\nCash\nPAYMENTMETHOD\nQTY\nITEM\nAMT.($)\nPaneerCurry\n$89\nChickenCurry\n$120\nEggCurry\n$100\nSUB-TOTAL\n$309\nTax\n$0.00\nAMT:\n$309.00\nTHANKSFORVISIT",
  },
  {
    id: "34_1111404014312483523",
    want: [10000],
    merchant: "Bank",
    text: "07:24\npRaBhaBank\nPaymentReceipt\nReference Code\n159838058\nSender's Name\nMAGAR\nSender's Account\n167##40500161591\nReceiver's Name\nMAGAR\nReceiver'sAccount\n167##24144100011\nDate/Time\n10Apr2026,07:24pm\nService Name\nINTERNALFUNDTRANSFER\nAmount (NPR)\n10,000.00\nInitiator\n9860228253\nRemarks\nHupendra gharti\nChannel\nOnline\nStatus\nSUCCESS\nThankyou, PrabhuBank\nPrabhuBuilding.Babarmahal,Kathmandu\nTranslatethedocument info",
  },
  {
    id: "35_988258711993968117",
    want: [142],
    merchant: "Eastern power",
    text: "Eastern\npower\nPAYMENTRECEIPT\nTransactionNo:\nPYTM25329167167\nConsumerNo:\n121101K047003986\nDate:\n25-11-2025\nSection:\nBUCHCHANNAKONERU\nERO:\nERO-VIZIANAGARAMTOWN\nReceivedFrom:\nMACHARLASAILAKSHMI\nBill Amount :\n142\nRCAmount:\nAmount Paid:\n142.00\nContact Info\n1912\nCall center (tollfree) :\nAEE/Operation:\n9440812465\nDy.EE/Operation:\n9440812455\nEE/Operation:\n9440812449\nAAO/ERO:\n9440812485",
  },
  {
    id: "36_PayMe_India_customer_care_number________",
    want: [1,195],
    merchant: "Partha Sarathi Das",
    note: "UPI history: +R1, -7195, skip Failed rows",
    text: "11:05l.l20\nBalance&History\nUPISettings\nPersonal Loan\nGet it Now\nGetup to3lacs in2minutes!\nView All\nPayment History\nSearchorfilterpayments\nReceivedfromParthaSarathiDas\n+R1\nPD\nToday,10:52 PM\nReceived In\nMoneytransferfailedtoSujeetKumarNagar\n99\nSN\nToday.07:36PM\nFailed\nMoney sent to Sujeet KumarNagar\n-7195\nSN\nToday,07:36PM\nSent From\nMoney transferfailedto SujeetKumarNagar\n7800\nSN\nToday.07:35PM\nFailed\nMoney transfer failed to Vivek Kumar\n7800\nVK\nToday,07:33PM\nFailed\nMoney transfer failed to Vivek Kumar\nVK\nToday,06:47PM\nFailed\nPaidtoWinZO\n11Feb,11:09AM\nPaid from",
  },
  {
    id: "37_1060738518501300556",
    want: [18000],
    merchant: "AYA PAY",
    note: "\"Fee 100MMK Total 18,000MMK\"",
    text: "AYA PAY\nE-Receipt\nTransactionName\nYESCEMBillPayment\nTransaction Code\n256303819204\nTransaction\ndone\nStatus\nSource Money\nAYAPAYWallet\nTime\n13February2026,11:30AM\nBill ID\n036001841\nMeter No.\n1511096161\nAmount\n17,900MMK\nFee\n100MMK\nTotal\n18,000MMK\nPoweredbyAYABank",
  },
  {
    id: "38_720787115417570869",
    want: [10000000],
    merchant: "Sarifa Begum",
    text: " Pay\nPayment successful\n1,00,00,000\nRupees One Crore Only\nSarifa Begum\nsarifa.begum@okhdfcbank\nPaid to\nSarifa Begum\nUPIID\nsarifa.begum@okhdfcbank\nDate&time\n17July2026,7:20PM\nUPI transaction ID\n312626113255\nShare receipt\nNeed help?\nPowered by\nUP",
  },
];

const almost = (a: number, b: number) => Math.abs(a - b) < 0.05;
let fail = 0;
let skipped = 0;
for (const c of cases) {
  const entries = extractMoneyEntries(c.text);
  const one = extractMoneyAmount(c.text);
  const usable = one && (one.score >= 48 || one.confidence !== 'low');
  const got = entries.length > 1 ? entries.map((e) => e.amount) : usable ? [one!.amount] : [];
  const merchants = entries.length > 1 ? entries.map((e) => e.merchant) : [one?.merchant || ''];
  if (c.skip) {
    skipped += 1;
    console.log('SKIP', c.id.padEnd(44), 'got', got, '—', c.skip);
    continue;
  }
  let ok = got.length === c.want.length && c.want.every((w, i) => almost(w, got[i]));
  if (ok && c.merchant) ok = merchants.some((m) => m.toLowerCase().includes(c.merchant!.toLowerCase()));
  if (!ok) fail += 1;
  console.log(ok ? 'OK  ' : 'FAIL', c.id.padEnd(44), 'got', got, merchants.join(' | ') || '-', 'want', c.want, c.merchant || '', c.note || '');
}
console.log(fail ? `\n${fail} FAILED (${skipped} skipped)` : `\nALL PASSED (${skipped} skipped as engine limitations)`);
process.exit(fail ? 1 : 0);
