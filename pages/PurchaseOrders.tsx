
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../services/db';
import { t } from '../utils/t';
import { PurchaseOrder, PurchaseItem } from '../types';
import { Plus, Save, ArrowLeft, Trash2, ShoppingBag, FileText, Search, Clock, TrendingUp, Truck, Check, X, ClipboardCheck } from 'lucide-react';
import { useHistory } from 'react-router-dom';
import SearchableSelect from '../components/SearchableSelect';

export default function PurchaseOrders() {
  const history = useHistory();
  const currency = db.getSettings().currency;
  
  const [activeTab, setActiveTab] = useState<'NEW